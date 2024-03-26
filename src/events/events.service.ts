import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { Event } from '@prisma/client';
import { PrismaService } from 'src/config/prisma/prisma.service';
import {
  CreateEventDto,
  UpdateEventDto,
  findAllEventsDto,
} from './dtos/events.dto';
import { ApiResponse } from 'src/common/types/response.type';

import * as dayjs from 'dayjs';

@Injectable()
export class EventsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: CreateEventDto, creatorId: string): Promise<ApiResponse> {
    const isInvalidDate = dayjs(data.datetime).isBefore(dayjs());

    if (isInvalidDate)
      throw new BadRequestException('The date must be in the future');

    const event = await this.prismaService.event.create({
      data: {
        title: data.title,
        datetime: data.datetime,
        location: data.location,
        thumbnail: data.thumbnail,
        creatorId,
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      data: event,
      message: 'Event created successfully',
    };
  }

  async findAll(query: findAllEventsDto): Promise<ApiResponse> {
    const {
      year = dayjs().year(),
      startMonth,
      endMonth,
      groupedByMonth,
    } = query;

    const monthRangeProvided = startMonth && endMonth;
    const isValidMonthRange = endMonth >= startMonth;
    const isSameMonth = startMonth === endMonth;

    if (monthRangeProvided && !isValidMonthRange)
      throw new BadRequestException('Invalid month range');

    // If the month range is provided and the start and end month are the same or if the month range is not provided, we group by month
    const defaultGroupByMonth = !monthRangeProvided || !isSameMonth;

    // If groupedByMonth is provided, we use it, otherwise we use the default behavior
    const isGroupByMonth = groupedByMonth ?? defaultGroupByMonth;

    // By default, we get all events for the year
    let startOfYear = dayjs().year(year).startOf('year');
    let endOfYear = dayjs().year(year).endOf('year');

    // If startMonth and endMonth are provided, we filter the events
    if (monthRangeProvided) {
      startOfYear = startOfYear.month(startMonth - 1).startOf('month');
      endOfYear = endOfYear.month(endMonth - 1).endOf('month');
    }

    const events = await this.prismaService.event.findMany({
      where: {
        datetime: {
          gte: startOfYear.toDate(),
          lte: endOfYear.toDate(),
        },
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    return {
      statusCode: HttpStatus.OK,
      data: {
        isGrouped: isGroupByMonth,
        events: isGroupByMonth ? this.groupByMonth(events) : events,
      },
      message: 'Events retrieved successfully',
    };
  }

  async findOne(id: string): Promise<ApiResponse> {
    const event = await this.prismaService.event.findUnique({
      where: {
        id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            lastname: true,
            email: true,
          },
        },
      },
    });

    if (!event) throw new BadRequestException('Event not found');

    return {
      statusCode: HttpStatus.OK,
      data: event,
      message: 'Event retrieved successfully',
    };
  }

  async update(id: string, data: UpdateEventDto): Promise<ApiResponse> {
    // Check if the event exists
    await this.findOne(id);

    if (data.datetime) {
      const isInvalidDate = dayjs(data.datetime).isBefore(dayjs());

      if (isInvalidDate)
        throw new BadRequestException('The date must be in the future');
    }

    const event = await this.prismaService.event.update({
      where: {
        id,
      },
      data: {
        ...data,
      },
    });

    return {
      statusCode: HttpStatus.OK,
      data: event,
      message: 'Event updated successfully',
    };
  }

  async delete(id: string): Promise<ApiResponse> {
    // Check if the event exists
    await this.findOne(id);

    await this.prismaService.event.delete({
      where: {
        id,
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Event deleted successfully',
      data: null,
    };
  }

  //--------------------------------
  //  Auxiliar service methods
  //--------------------------------
  private groupByMonth(events: Event[]): Record<string, Event[]> {
    return events.reduce((acc, event) => {
      const month = dayjs(event.datetime).format('MMMM');

      if (!acc[month]) {
        acc[month] = [];
      }

      acc[month].push(event);

      return acc;
    }, {});
  }
}
