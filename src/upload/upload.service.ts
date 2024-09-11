import { BadRequestException, Injectable } from '@nestjs/common';
import * as ip from 'ip';
import * as csvParser from 'csv-parser';
import { Readable } from 'stream';

import * as fs from 'fs-extra';
import * as path from 'path';
import { JsonType, JsonTypeShort } from './json.type';
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
          const filteredGeoname = this.filterByGeonameId(
            results,
            geonameIDsArr,
          ); //отфильровал ненужные страны
          const filteredFields = this.removeFields(filteredGeoname); // удалил ненужные поля
          const expanded = this.expandNetworksInJson(filteredFields); // расширил json для все комбинаций ip

          await this.saveJsonToFile(expanded);

          return results;
        });

      return { message: 'success!' };
    } catch (error) {
      throw new BadRequestException('Error upload');
    }
  }

  filterByGeonameId(data: JsonType[], geonameIds: string[]): JsonType[] {
    return data.filter((item) => geonameIds.includes(item.geoname_id));
  }

  expandNetwork(network: string): string[] {
    const range = ip.cidrSubnet(network);
    const startIP = range.firstAddress;
    const endIP = range.lastAddress;

    const result: string[] = [];
    let currentIP = startIP;

    while (ip.toLong(currentIP) <= ip.toLong(endIP)) {
      result.push(currentIP);
      currentIP = ip.fromLong(ip.toLong(currentIP) + 1);
    }

    return result;
  }

  expandNetworksInJson(inputJson: JsonTypeShort[]): JsonTypeShort[] {
    return inputJson
      .map((entry) => {
        const expandedIps = this.expandNetwork(entry.network);
        return expandedIps.map((ipAddress) => ({
          ...entry,
          network: ipAddress,
        }));
      })
      .flat();
  } // развернуть в json все комбинации ip

  removeFields(data: JsonType[]): JsonTypeShort[] {
    return data.map(
      ({ network, geoname_id, registered_country_geoname_id }) => ({
        network,
        geoname_id,
        registered_country_geoname_id,
      }),
    );
  } // удалить ненужные поля

  async splitAndUploadCsv(buffer: Buffer, linesPerFile: number = 2000) {
    const outputDir = path.join(__dirname, '..', '..', 'uploads', 'splitted');
    const fileName = 'splitted';

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let currentFileIndex = 0;
    let currentLineCount = 0;
    let fileStream: fs.WriteStream | null = null;

    const dataStream = buffer.toString('utf-8');
    const lines = dataStream.split('\n'); // Разделяем на строки

    for (const line of lines) {
      if (currentLineCount === 0) {
        const newFilePath = path.join(
          outputDir,
          `${fileName}_part_${currentFileIndex + 1}.csv`,
        );
        fileStream = fs.createWriteStream(newFilePath); // Создаем поток для записи
        currentFileIndex++;
      }

      if (fileStream) {
        fileStream.write(line + '\n');
      }

      currentLineCount++;
      if (currentLineCount >= linesPerFile) {
        currentLineCount = 0;
        if (fileStream) fileStream.end(); // Закрываем поток, если достигнуто количество строк
      }
    }

    if (fileStream) {
      fileStream.end();
    }

    return { message: 'File successfully processed and split into parts' };
  }
}
