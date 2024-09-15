import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CsvService } from '../csv/csv.service';
import { PrismaService } from 'src/prisma.service';
@Module({
  imports: [
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 1024 * 1024 * 130,
        files: 1,
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, CsvService, PrismaService],
})
export class UploadModule {}
