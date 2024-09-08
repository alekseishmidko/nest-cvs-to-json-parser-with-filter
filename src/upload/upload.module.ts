import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
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
  providers: [UploadService],
})
export class UploadModule {}
