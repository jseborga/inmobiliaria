import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PhoneOtpService } from './phone-otp.service';
import { PublicVisitsController } from './public-visits.controller';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [WhatsappModule],
  controllers: [VisitsController, PublicVisitsController],
  providers: [VisitsService, PhoneOtpService],
  exports: [VisitsService, PhoneOtpService],
})
export class VisitsModule {}
