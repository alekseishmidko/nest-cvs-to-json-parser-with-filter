import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { CsvService } from './csv.service';

@Controller('csv')
export class CsvController {
  uploadService: any;
  constructor(private readonly csvService: CsvService) {}
  @Post('') @UseInterceptors(FileInterceptor('file')) async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.csvService.parseCsvFile(file);
  }

  @Post('array') @UseInterceptors(FileInterceptor('file')) async convertCsv(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.csvService.parseCsvFile(file);
  }
}
