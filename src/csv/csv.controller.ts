import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
    @Query('country') country: string,
  ) {
    if (!file) throw new BadRequestException(`File is required!`);
    return this.csvService.parseCsvFile(file, country);
  }

  @Post('array')
  @UseInterceptors(FileInterceptor('file'))
  async convertCsv() {
    return this.csvService.processIpsToJsonShortAndSaveToDB();
  }
  @Get('find/:country')
  async get(@Param('country') country: string, @Query('page') page: number) {
    return this.csvService.get(country, page);
  }
  @Get('find-save/:country')
  async getAndSave(@Param('country') country: string) {
    return this.csvService.getAndSaveInFolder(country);
  }
}
