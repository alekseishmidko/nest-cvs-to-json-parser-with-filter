import { BadRequestException, Injectable } from '@nestjs/common';
import * as ip from 'ip';
import * as csvParser from 'csv-parser';
import { Readable } from 'stream';
import * as JSONStream from 'JSONStream';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { JsonType, JsonTypeShort } from './json.type';
import { CsvService } from '../csv/csv.service';
@Injectable()
export class UploadService {
  constructor(private readonly csvService: CsvService) {}
  private outputDir = path.join(__dirname, '..', '..', 'uploads');
  async saveJsonToFile(jsonData: any): Promise<string> {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

    await fs.ensureDir(uploadsDir);

    const fileName = `json_new_${Date.now()}.json`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeJson(filePath, jsonData, { spaces: 2 });

    return filePath;
  }

  async uploadCsv(file: Express.Multer.File) {
    const results = [];
    const stream = Readable.from(file.buffer.toString());
    // const geonameIDsArr = geonameIDs.split(',');
    //   ['3144096', '2635167', '6251999', '660013', '2661886']; //Norway, UK, Canada,Finland,Sweden
    try {
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          if (!['2661886'].includes(data.geoname_id)) return;
          if (data.network) {
            results.push({
              geoname_id: data.geoname_id,
              network: data.network,
            });
          }
        })
        .on('end', async () => {
          await this.saveJsonToFile(results);

          return results;
        });

      return { message: 'success!' };
    } catch (error) {
      throw new BadRequestException('Error upload');
    }
  }

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
        if (fileStream) fileStream.end();
      }
    }

    if (fileStream) {
      fileStream.end();
    }

    return { message: 'File successfully processed and split into parts' };
  }

  async splitAndUploadJson(buffer: Buffer, objectsPerFile: number = 2000) {
    const outputDir = path.join(__dirname, '..', '..', 'uploads', 'splitted');
    const fileName = 'splitted';

    // Создаем директорию для загрузки, если ее нет
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let currentFileIndex = 0;
    let currentObjectCount = 0;
    let fileStream: fs.WriteStream | null = null;

    try {
      // Преобразуем буфер в JSON-массив
      const jsonArray = JSON.parse(buffer.toString('utf-8'));

      for (const jsonObject of jsonArray) {
        // Если мы достигли лимита объектов на файл или только начинаем, создаем новый файл
        if (currentObjectCount === 0) {
          const newFilePath = path.join(
            outputDir,
            `${fileName}_part_${currentFileIndex + 1}.json`,
          );
          fileStream = fs.createWriteStream(newFilePath); // Создаем поток для записи
          fileStream.write('['); // Начинаем JSON-массив
          currentFileIndex++;
        } else {
          fileStream?.write(','); // Добавляем запятую перед следующими объектами
        }

        // Записываем объект в файл
        fileStream?.write(JSON.stringify(jsonObject));

        currentObjectCount++;

        // Если мы достигли лимита объектов на файл, закрываем текущий файл
        if (currentObjectCount >= objectsPerFile) {
          currentObjectCount = 0;
          fileStream?.write(']'); // Закрываем JSON-массив
          fileStream?.end();
        }
      }

      // Если файл еще не был закрыт (остались объекты, но их меньше objectsPerFile)
      if (fileStream) {
        fileStream.write(']'); // Закрываем JSON-массив
        fileStream.end();
      }

      return { message: 'JSON successfully processed and split into parts' };
    } catch (error) {
      throw new BadRequestException('Error processing JSON');
    }
  }

  expandNetwork(network: string): Readable {
    const range = ip.cidrSubnet(network);
    const startIP = ip.toLong(range.firstAddress);
    const endIP = ip.toLong(range.lastAddress);

    const ipStream = new Readable({
      read() {
        for (let currentIP = startIP; currentIP <= endIP; currentIP++) {
          this.push(ip.fromLong(currentIP));
        }
        this.push(null); // Завершаем стрим
      },
    });

    return ipStream;
  }
}
