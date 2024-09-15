import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as csvParser from 'csv-parser';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ip from 'ip';

import { JsonTypeExpand, JsonTypeShort } from '../upload/json.type';
import { PrismaService } from 'src/prisma.service';
@Injectable()
export class CsvService {
  constructor(private readonly prisma: PrismaService) {}
  private outputDir = path.join(__dirname, '..', '..', 'uploads', 'csv');

  async parseCsvFile(
    file: Express.Multer.File,
    country: string,
  ): Promise<{ network: string; geoname_id: string }[]> {
    const results: { network: string; geoname_id: string }[] = [];

    return new Promise((resolve, reject) => {
      const stream = Readable.from(file.buffer);
      // const folder = '2635167';
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          if (data.geoname_id === country) {
            results.push({
              network: data.network,
              geoname_id: data.geoname_id,
            });
          }
        })
        .on('end', async () => {
          const res = await this.convertCidrToIpRangeAndSave(results);
          // const res2 = await this.processIpRangesAndSave2(res, folder);
          await this.processIpRangesAndSaveToDB(res);
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  expandNetwork(data: JsonTypeShort): JsonTypeShort[] {
    if (!data.network || !data.network.includes('/')) {
      throw new Error(`Invalid CIDR format in network: ${data.network}`);
    }

    const range = ip.cidrSubnet(data.network); // Получаем диапазон IP-адресов
    const startIP = ip.toLong(range.firstAddress); // Преобразуем первый адрес в числовой формат
    const endIP = ip.toLong(range.lastAddress); // Преобразуем последний адрес в числовой формат

    const result: JsonTypeShort[] = [];
    for (let currentIP = startIP; currentIP <= endIP; currentIP++) {
      result.push({
        network: ip.fromLong(currentIP),
        geoname_id: data.geoname_id,
      });
    }

    return result;
  }

  async convertCidrToIpRangeAndSave(
    jsonData: JsonTypeShort[],
  ): Promise<JsonTypeExpand[]> {
    const result = jsonData.map((entry) => {
      const { network, geoname_id } = entry;

      // Разбиваем сеть на IP-адрес и маску
      const firstIp = ip.cidrSubnet(network).networkAddress;
      const lastIp = ip.cidrSubnet(network).broadcastAddress;

      return {
        network,
        geoname_id,
        firstIp,
        lastIp,
      };
    });

    // Путь для сохранения нового файла JSON
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'cvs');
    await fs.ensureDir(uploadsDir);

    const fileName = `converted_ip_ranges_${Date.now()}.json`;
    const filePath = path.join(uploadsDir, fileName);

    // Сохраняем новый файл
    await fs.writeJson(filePath, result, { spaces: 2 });

    return result;
  }

  async processIpRangesAndSave(
    jsonData: JsonTypeExpand[],
    folder: string,
  ): Promise<void> {
    // Проходим по каждому диапазону
    jsonData.forEach(async (entry, index) => {
      let result: { network: string; geoname_id: string; ips: string[] }[] = [];
      const { network, geoname_id, firstIp, lastIp } = entry;

      // Генерируем полный список IP-адресов от firstIp до lastIp
      const ips = [];
      let currentIp = firstIp;

      while (ip.toLong(currentIp) <= ip.toLong(lastIp)) {
        ips.push(currentIp);
        currentIp = ip.fromLong(ip.toLong(currentIp) + 1);
      }

      result.push({
        network,
        geoname_id,
        ips,
      });
      const uploadsDir = path.join(
        __dirname,
        '..',
        '..',
        'uploads',
        `${folder}`,
      );
      await fs.ensureDir(uploadsDir);
      const fileName = `expanded_ips_arr_${index}.json`;
      const filePath = path.join(uploadsDir, fileName);

      // Сохраняем результат в JSON-файл
      await fs.writeJson(filePath, result, { spaces: 2 });

      result = [];
    });
  }

  async processIpRangesAndSave2(
    jsonData: JsonTypeExpand[],
    folder: string,
  ): Promise<void> {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', `${folder}`);
    await fs.ensureDir(uploadsDir);

    // Обработка диапазонов последовательно для предотвращения перегрузки системы
    for (let index = 0; index < jsonData.length; index++) {
      const entry = jsonData[index];
      const { network, geoname_id, firstIp, lastIp } = entry;

      // Генерация списка IP-адресов с использованием потока для записи файла по мере генерации
      const fileName = `expanded_ips_arr_${index}.json`;
      const filePath = path.join(uploadsDir, fileName);
      const fileStream = fs.createWriteStream(filePath);

      fileStream.write('[\n');

      let first = true;
      let currentIp = firstIp;
      while (ip.toLong(currentIp) <= ip.toLong(lastIp)) {
        if (!first) {
          fileStream.write(',\n');
        }
        fileStream.write(
          JSON.stringify({
            network,
            geoname_id,
            ip: currentIp,
          }),
        );
        first = false;
        currentIp = ip.fromLong(ip.toLong(currentIp) + 1);
      }

      fileStream.write('\n]');
      fileStream.end();

      console.log(`File saved: ${filePath}`);
    }
  }
  transformIpJson(
    data: { network: string; geoname_id: string; ips: string[] }[],
  ): JsonTypeShort[] {
    const result: JsonTypeShort[] = [];

    data.forEach((entry) => {
      entry.ips.forEach((ip) => {
        result.push({
          network: ip,
          geoname_id: entry.geoname_id,
        });
      });
    });

    return result;
  }

  async processIpsToJsonShort() {
    const inputFolder = path.join(__dirname, '..', '..', 'uploads', '6251999');
    const outputFolder = path.join(
      __dirname,
      '..',
      '..',
      'uploads',
      '6251999',
      'transformed',
    );

    try {
      await fs.ensureDir(outputFolder);

      const files = await fs.readdir(inputFolder);

      for (const file of files) {
        const filePath = path.join(inputFolder, file);
        const outputFilePath = path.join(outputFolder, `transformed_${file}`);

        // Чтение содержимого файла
        const fileData = await fs.readJson(filePath);
        const transformedData = this.transformIpJson(fileData);

        // Сохранение трансформированного файла
        await fs.writeJson(outputFilePath, transformedData, { spaces: 2 });

        console.log(`File processed and saved: ${outputFilePath}`);
      }
    } catch (error) {
      console.error('Error processing files:', error);
    }
  }
  async processIpsToJsonShortAndSaveToDB() {
    const inputFolder = path.join(__dirname, '..', '..', 'uploads', '3144096');

    try {
      const files = await fs.readdir(inputFolder);

      for (const file of files) {
        const filePath = path.join(inputFolder, file);

        // Чтение содержимого файла
        const fileData = await fs.readJson(filePath);
        await this.transformIpAndSave(fileData);

        console.log(`File processed and saved:  `);
      }
    } catch (error) {
      console.error('Error processing files:', error);
    }
  }

  async transformIpAndSave(
    data: { network: string; geoname_id: string; ips: string[] }[],
  ) {
    try {
      for (const entry of data) {
        const { geoname_id, ips } = entry;

        for (const ip of ips) {
          await this.prisma.ip.create({
            data: {
              network: ip, // Один из элементов массива ips
              geoname_id: geoname_id, // geoname_id из текущего объекта
            },
          });
        }
      }

      console.log('All IPs have been saved to the database.');
    } catch (error) {
      console.error('Error saving IPs to database:', error);
    }
  }

  async get(country: string, page: number) {
    const limit = 100000;
    const startIndex = (page - 1) * limit;
    return this.prisma.ip.findMany({
      where: { geoname_id: country },
      select: { geoname_id: true, network: true },
      skip: startIndex,
      take: +limit,
    });
  }

  async getAndSaveInFolder(country: string) {
    const outputFolder = path.join(
      __dirname,
      '..',
      '..',
      'uploads',
      `${country}`,
      'save-from-db',
    );
    let page = 1;
    let hasMoreData = true;
    await fs.ensureDir(outputFolder);

    while (hasMoreData) {
      // Получаем данные с БД
      const data = await this.get(country, page);

      if (data.length === 0) {
        hasMoreData = false;
        console.log('All data has been fetched.');
        break;
      }

      const filePath = path.join(outputFolder, `data_page_${page}.json`);

      await fs.writeJson(filePath, data, { spaces: 2 });

      console.log(`Page ${page} data saved to ${filePath}`);

      page++;
    }
  }

  async processIpRangesAndSaveToDB(
    jsonData: {
      geoname_id: string;
      network: string;
      firstIp: string;
      lastIp: string;
    }[],
  ): Promise<void> {
    const BATCH_SIZE = 1000; // Пакетная вставка данных в БД
    try {
      for (const entry of jsonData) {
        const { geoname_id, firstIp, lastIp } = entry;
        let currentIp = firstIp;
        let batch = [];

        // Генерация и пакетная вставка IP-адресов
        while (ip.toLong(currentIp) <= ip.toLong(lastIp)) {
          batch.push({
            geoname_id: geoname_id,
            network: currentIp,
          });

          // Вставка в базу данных, когда накоплено BATCH_SIZE записей
          if (batch.length >= BATCH_SIZE) {
            await this.prisma.ip.createMany({
              data: batch,
              skipDuplicates: true, // Пропуск дубликатов
            });
            console.log(
              `Inserted batch of ${BATCH_SIZE} IPs into the database.`,
            );
            batch = []; // Очистка для следующего батча
          }

          // Переход к следующему IP
          currentIp = ip.fromLong(ip.toLong(currentIp) + 1);
        }

        // Вставка оставшихся данных, если есть
        if (batch.length > 0) {
          await this.prisma.ip.createMany({
            data: batch,
            skipDuplicates: true,
          });
          console.log(
            `Inserted final batch of ${batch.length} IPs into the database.`,
          );
        }
      }

      console.log(
        'All IP ranges have been processed and saved to the database.',
      );
    } catch (error) {
      console.error('Error saving IPs to the database:', error);
    }
  }
}
