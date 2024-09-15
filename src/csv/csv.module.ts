import { Module } from '@nestjs/common';
import { CsvService } from './csv.service';
import { CsvController } from './csv.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CsvController],
  providers: [CsvService, PrismaService],
})
export class CsvModule {}
