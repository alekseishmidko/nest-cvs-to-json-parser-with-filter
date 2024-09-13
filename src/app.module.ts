import { Module } from '@nestjs/common';

import { UploadModule } from './upload/upload.module';
import { CsvModule } from './csv/csv.module';

@Module({
  imports: [UploadModule, CsvModule],
})
export class AppModule {}
