import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PublicLeadsController } from './public-leads.controller';

@Module({
  controllers: [LeadsController, PublicLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
