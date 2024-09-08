import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('csv') @UseInterceptors(FileInterceptor('file')) async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @Query('geonameIDs') geonameIDs: string,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.uploadService.uploadCsv(file, geonameIDs);
  }
}
