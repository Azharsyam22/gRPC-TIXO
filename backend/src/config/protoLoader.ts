import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

export interface ITixoProtoPackage extends grpc.GrpcObject {
  TixoService: grpc.ServiceClientConstructor;
}

/**
 * Resolves the path to tixo.proto dynamically:
 * Checks src/proto/tixo.proto first, falls back to ../proto/tixo.proto.
 */
export function getProtoPath(): string {
  const candidatePaths = [
    path.resolve(__dirname, '../proto/tixo.proto'),
    path.resolve(__dirname, '../../src/proto/tixo.proto'),
    path.resolve(__dirname, '../../../proto/tixo.proto'),
    path.resolve(process.cwd(), 'src/proto/tixo.proto'),
    path.resolve(process.cwd(), 'proto/tixo.proto'),
    path.resolve(process.cwd(), '../proto/tixo.proto'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`File tixo.proto tidak ditemukan. Pencarian dilakukan di:\n${candidatePaths.join('\n')}`);
}

/**
 * Loads and returns the gRPC package definition for TIXO.
 */
export function loadTixoProtoDefinition(): protoLoader.PackageDefinition {
  const protoFile = getProtoPath();

  return protoLoader.loadSync(protoFile, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
}

/**
 * Returns the loaded TixoService definition from the proto file.
 */
export function getTixoServiceDefinition(): grpc.ServiceDefinition {
  const packageDef = loadTixoProtoDefinition();
  const protoGrpc = grpc.loadPackageDefinition(packageDef);
  
  const tixoPkg = protoGrpc['tixo'] as ITixoProtoPackage | undefined;
  if (!tixoPkg || !tixoPkg.TixoService) {
    throw new Error('Gagal menemukan service definition "tixo.TixoService" pada tixo.proto');
  }

  return tixoPkg.TixoService.service;
}

/**
 * Returns the loaded Tixo gRPC client constructor.
 */
export function getTixoClientConstructor(): grpc.ServiceClientConstructor {
  const packageDef = loadTixoProtoDefinition();
  const protoGrpc = grpc.loadPackageDefinition(packageDef);
  
  const tixoPkg = protoGrpc['tixo'] as ITixoProtoPackage | undefined;
  if (!tixoPkg || !tixoPkg.TixoService) {
    throw new Error('Gagal menemukan client constructor "tixo.TixoService" pada tixo.proto');
  }

  return tixoPkg.TixoService;
}
