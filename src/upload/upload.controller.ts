import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('csv') @UseInterceptors(FileInterceptor('file')) async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    // @Query('geonameIDs') geonameIDs: string,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.uploadService.uploadCsv(file);
  }
  @Post('csv/split')
  @UseInterceptors(FileInterceptor('file'))
  async splitAndUploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.uploadService.splitAndUploadCsv(file.buffer);
  }

  // @Post('json/filter')
  // @UseInterceptors(FileInterceptor('file'))
  // async filterJson(@UploadedFile() file: Express.Multer.File) {
  //   if (!file) throw new BadRequestException(`File is required!`);
  //   return this.uploadService.filterJson(file);
  // }
  @Post('json/split')
  @UseInterceptors(FileInterceptor('file'))
  async splitJson(
    @UploadedFile() file: Express.Multer.File,
    @Query('split') split: number,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.uploadService.splitAndUploadJson(file.buffer, split);
  }
}
