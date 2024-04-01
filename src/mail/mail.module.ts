import { Module } from '@nestjs/common';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import envConfig from 'src/config/environment/env.config';
import { ConfigType } from '@nestjs/config';
import { ThrottlerModule, seconds } from '@nestjs/throttler';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [envConfig.KEY],
      useFactory: (configService: ConfigType<typeof envConfig>) => ({
        transport: {
          host: configService.smtp.host,
          port: configService.smtp.port,
          secure: configService.smtp.secure,
          auth: {
            user: configService.smtp.auth.user,
            pass: configService.smtp.auth.pass,
          },
        },
        defaults: {
          from: configService.smtp.defaults.from,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [envConfig.KEY],
      useFactory: (configService: ConfigType<typeof envConfig>) => [
        {
          limit: configService.rateLimit.email.limit,
          ttl: seconds(configService.rateLimit.email.ttl),
        },
      ],
    }),
  ],
  providers: [MailService],
  controllers: [MailController],
})
export class MailModule {}
