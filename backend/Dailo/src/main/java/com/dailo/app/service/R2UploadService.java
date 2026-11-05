package com.dailo.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

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

        // 빈 값뿐 아니라 application.yml 예시 값(YOUR_...)도 미설정으로 취급 → 로컬 저장으로 대체됨 (ImageStorageService)
        boolean isConfigured = isSet(accountId) && isSet(accessKey)
                && isSet(secretKey) && isSet(bucketName) && isSet(publicDomain);
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

    static boolean isSet(String value) {
        return value != null && !value.isBlank() && !value.contains("YOUR_");
    }

    public boolean isConfigured() {
        return configured;
    }

    // 형식 검증·확장자 결정은 ImageStorageService가 담당
    public String upload(String folder, byte[] bytes, String ext, String contentType) {
        if (!configured) {
            throw new IllegalStateException("R2 스토리지가 설정되지 않았습니다. application.yml의 r2 설정을 확인해주세요.");
        }
        String key = folder + "/" + UUID.randomUUID() + ext;

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(bytes)
        );

        return publicDomain + "/" + key;
    }

    // 이 버킷 공개 주소로 올린 파일인지 — 외부 주소·로컬 주소는 false
    public boolean owns(String imageUrl) {
        return configured && imageUrl != null && imageUrl.startsWith(publicDomain + "/")
                && imageUrl.length() > publicDomain.length() + 1;
    }

    public void delete(String imageUrl) {
        if (!owns(imageUrl)) return;
        String key = imageUrl.substring(publicDomain.length() + 1);
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build());
    }
}
