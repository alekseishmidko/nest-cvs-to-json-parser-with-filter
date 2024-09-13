import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as csvParser from 'csv-parser';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ip from 'ip';
import * as fastCsv from 'fast-csv';

import { JsonTypeExpand, JsonTypeShort } from '../upload/json.type';
@Injectable()
export class CsvService {
  private outputDir = path.join(__dirname, '..', '..', 'uploads', 'csv');

  async parseCsvFile(
    file: Express.Multer.File,
  ): Promise<{ network: string; geoname_id: string }[]> {
    const results: { network: string; geoname_id: string }[] = [];

    return new Promise((resolve, reject) => {
      const stream = Readable.from(file.buffer);

      stream
        .pipe(csvParser())
        .on('data', (data) => {
          if (data.geoname_id === '2635167') {
            results.push({
              network: data.network,
              geoname_id: data.geoname_id,
            });
          }
        })
        .on('end', async () => {
          const res = await this.convertCidrToIpRangeAndSave(results);
          const res2 = await this.processIpRangesAndSave(res);
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

  async processIpRangesAndSave(jsonData: JsonTypeExpand[]): Promise<void> {
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
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', '2635167');
      await fs.ensureDir(uploadsDir);
      const fileName = `expanded_ips_arr_${index}.json`;
      const filePath = path.join(uploadsDir, fileName);

      // Сохраняем результат в JSON-файл
      await fs.writeJson(filePath, result, { spaces: 2 });

      result = [];
    });
  }

  // async get(file: Express.Multer.File) {}
}
