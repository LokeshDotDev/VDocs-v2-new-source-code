import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
	PORT: z.coerce.number().min(1).max(65535),
	TUS_PATH: z.string(),
	TUS_STORAGE_DIR: z.string(),
	MAX_UPLOAD_SIZE_BYTES: z.coerce.number().min(1),
	MINIO_ENDPOINT: z.string(),
	MINIO_PORT: z.coerce.number().min(1).max(65535),
	MINIO_USE_SSL: z.enum(["true", "false"]).transform((val) => val === "true"),
	MINIO_ACCESS_KEY: z.string(),
	MINIO_SECRET_KEY: z.string(),
	MINIO_BUCKET: z.string(),
});

const envVars = configSchema.parse(process.env);

export const config = {
	port: envVars.PORT,
	tusPath: envVars.TUS_PATH,
	storageDir: envVars.TUS_STORAGE_DIR,
	maxUploadSizeBytes: envVars.MAX_UPLOAD_SIZE_BYTES,
	minio: {
		endpoint: envVars.MINIO_ENDPOINT,
		port: envVars.MINIO_PORT,
		useSSL: envVars.MINIO_USE_SSL,
		accessKey: envVars.MINIO_ACCESS_KEY,
		secretKey: envVars.MINIO_SECRET_KEY,
		bucket: envVars.MINIO_BUCKET,
	},
};
