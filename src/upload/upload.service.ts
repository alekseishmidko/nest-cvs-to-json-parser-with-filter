import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as csvParser from 'csv-parser';
import { Readable } from 'stream';

import * as fs from 'fs-extra';
import * as path from 'path';
@Injectable()
export class UploadService {
  async saveJsonToFile(jsonData: any): Promise<string> {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    await fs.ensureDir(uploadsDir);

    const fileName = `json_${Date.now()}.json`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeJson(filePath, jsonData, { spaces: 2 });

    return filePath;
  }

  async uploadCsv(file: Express.Multer.File, geonameIDs: string) {
    const results = [];
    const stream = Readable.from(file.buffer.toString());
    const geonameIDsArr = geonameIDs.split(',');
    //   ['3144096', '2635167', '6251999', '660013', '2661886']; //Norway, UK, Canada,Finland,Sweden
    try {
      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const filtered = this.filterByGeonameId(results, geonameIDsArr);
          await this.saveJsonToFile(filtered);
          return results;
        });

      return { message: 'success!' };
    } catch (error) {
      throw new BadRequestException('Error upload');
    }
  }

  filterByGeonameId(data: any[], geonameIds: string[]): any[] {
    return data.filter((item) => geonameIds.includes(item.geoname_id));
  }
}
