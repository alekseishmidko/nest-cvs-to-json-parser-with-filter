import { Injectable, BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import * as csvParser from 'csv-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as ip from 'ip';
import * as fastCsv from 'fast-csv';
@Injectable()
export class CsvService {
  private outputDir = path.join(__dirname, '..', '..', 'uploads', 'csv');

  private expandNetwork(network: string): string[] {
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

  async processCsvFile(file: Express.Multer.File): Promise<string> {
    const results = [];
    const fileBuffer = Readable.from(file.buffer.toString());
    const tempFilePath = path.join(this.outputDir, 'expanded_ips.csv');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(tempFilePath, {
      encoding: 'utf8',
    });
    const csvStream = fastCsv.format({ headers: true });

    csvStream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      fileBuffer
        .pipe(csvParser())
        .on('data', (data) => {
          if (data.network) {
            const expandedIps = this.expandNetwork(data.network);

            expandedIps.forEach((expandedIp) => {
              csvStream.write({
                network: expandedIp,
                geoname_id: data.geoname_id,
                registered_country_geoname_id:
                  data.registered_country_geoname_id,
                represented_country_geoname_id:
                  data.represented_country_geoname_id,
                is_anonymous_proxy: data.is_anonymous_proxy,
                is_satellite_provider: data.is_satellite_provider,
                is_anycast: data.is_anycast,
              });
            });
          }
        })
        .on('end', () => {
          csvStream.end();
          resolve(tempFilePath);
        })
        .on('error', (error) => {
          reject(
            new BadRequestException(
              'Error processing CSV file: ' + error.message,
            ),
          );
        });
    });
  }
}
