import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildSnippets,
  endpointsFromIndex,
  formatBytes,
  parseOpenApi,
  resolvePath,
  type ApiIndex,
} from './api';

const SAMPLE = `# Generated
openapi: "3.1.0"
info:
  title: "Demo API"
  version: "1.2.3"
servers:
  - url: "https://example.org/api/v1"
paths:
  "/index.json":
    get:
      summary: "Catalogue"
      operationId: "getIndex"
      responses:
        200:
          description: "ok"
  "/year/{year}.json":
    get:
      summary: "One \\"year\\""
      operationId: "by_year"
      tags:
        - "hai"
      parameters:
        - name: "year"
          in: "path"
          required: true
          schema:
            type: "integer"
            enum:
              - 2023
              - 2024
      responses:
        200:
          description: "ok"
  "/x.csv":
    get:
      summary: "csv"
      operationId: "x"
`;

describe('parseOpenApi', () => {
  it('reads info, server, paths, tags and enums', () => {
    const p = parseOpenApi(SAMPLE);
    expect(p.title).toBe('Demo API');
    expect(p.version).toBe('1.2.3');
    expect(p.server).toBe('https://example.org/api/v1');
    expect(p.endpoints.map((e) => e.path)).toEqual(['/index.json', '/year/{year}.json', '/x.csv']);
    const y = p.endpoints[1];
    expect(y.summary).toBe('One "year"');
    expect(y.tag).toBe('hai');
    expect(y.params).toEqual([{ name: 'year', in: 'path', values: ['2023', '2024'] }]);
    expect(p.endpoints[2].kind).toBe('csv');
  });

  it('parses the real generated openapi.yaml', () => {
    const text = readFileSync('public/api/v1/openapi.yaml', 'utf8');
    const p = parseOpenApi(text);
    expect(p.endpoints.length).toBeGreaterThan(25);
    const ph = p.endpoints.find((e) => e.path === '/resistance/phenotype/{phenotype}.json');
    expect(ph?.params[0].values).toContain('CRKP');
    expect(ph?.tag).toBe('resistance');
    expect(p.endpoints.find((e) => e.path === '/glass/country/{country}.json')?.params[0].values).toContain(
      'TWN',
    );
  });
});

describe('helpers', () => {
  it('resolvePath fills placeholders and keeps unknown ones', () => {
    expect(resolvePath('/a/{x}/{y}.json', { x: 'KPN' })).toBe('/a/KPN/{y}.json');
  });
  it('buildSnippets embeds the absolute url in all four languages', () => {
    const sn = buildSnippets('https://h.example/api/v1/hai.json', 'json');
    for (const k of ['curl', 'js', 'python', 'r'] as const)
      expect(sn[k]).toContain('https://h.example/api/v1/hai.json');
    expect(sn.r).toContain('httr2');
    expect(buildSnippets('https://h.example/a.csv', 'csv').python).toContain('read_csv');
  });
  it('endpointsFromIndex builds slice endpoints', () => {
    const idx = {
      baseUrl: 'https://h.example/api/v1',
      generatedAt: '',
      datasets: [
        {
          id: 'hai',
          dataset: 'hai',
          records: 1,
          provisional: true,
          version: '1',
          json: 'https://h.example/api/v1/hai.json',
          csv: 'https://h.example/api/v1/hai.csv',
          schema: '',
          slices: [
            { by: 'year', urlTemplate: 'https://h.example/api/v1/hai/year/{year}.json', values: [2024] },
          ],
        },
      ],
    } as ApiIndex;
    const eps = endpointsFromIndex(idx);
    expect(eps.some((e) => e.path === '/hai/year/{year}.json' && e.params[0].values[0] === '2024')).toBe(
      true,
    );
  });
  it('formatBytes', () => {
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(0, 'en')).toBe('');
  });
});
