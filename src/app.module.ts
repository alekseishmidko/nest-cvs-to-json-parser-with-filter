import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UploadModule } from './upload/upload.module';
import { CsvModule } from './csv/csv.module';

@Module({
  imports: [UploadModule, CsvModule],
  providers: [PrismaService],
})
export class AppModule {}
