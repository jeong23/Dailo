package com.dailo.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.util.UUID;

@Service
public class R2UploadService {

    private S3Client s3Client;
    private final String bucketName;
    private final String publicDomain;
    private final boolean configured;

    public R2UploadService(
            @Value("${r2.account-id:}") String accountId,
            @Value("${r2.access-key:}") String accessKey,
            @Value("${r2.secret-key:}") String secretKey,
            @Value("${r2.bucket-name:}") String bucketName,
            @Value("${r2.public-domain:}") String publicDomain) {

        this.bucketName = bucketName;
        this.publicDomain = publicDomain;

        boolean isConfigured = !accountId.isBlank() && !accessKey.isBlank()
                && !secretKey.isBlank() && !bucketName.isBlank() && !publicDomain.isBlank();
        this.configured = isConfigured;

        if (isConfigured) {
            this.s3Client = S3Client.builder()
                    .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .region(Region.of("auto"))
                    .build();
        }
    }

    public boolean isConfigured() {
        return configured;
    }

    public String upload(MultipartFile file) throws IOException {
        if (!configured) {
            throw new IllegalStateException("R2 스토리지가 설정되지 않았습니다. application.yml의 r2 설정을 확인해주세요.");
        }
        String ext = getExtension(file.getOriginalFilename());
        String key = "future-vision/" + UUID.randomUUID() + ext;

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(file.getContentType())
                        .build(),
                RequestBody.fromBytes(file.getBytes())
        );

        return publicDomain + "/" + key;
    }

    public void delete(String imageUrl) {
        if (!configured || imageUrl == null || imageUrl.isBlank()) return;
        String key = imageUrl.replace(publicDomain + "/", "");
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build());
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf("."));
    }
}
