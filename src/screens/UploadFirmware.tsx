import React, { useState } from 'react';
import { View, Button, Text, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { presignUpload, apiPOST } from '../api';
import { Buffer } from 'buffer';

interface PickedDocument {
  name: string;
  mimeType: string;
  size: number;
  uri: string;
}

interface PresignedUpload {
  upload_url: string;
  blob_url: string;
}

interface UploadOptions {
  url: string;
  blob: Blob;
  contentType: string;
  onProgress: (progress: number) => void;
}

export default function UploadFirmware({ navigation }: any) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function pickDocument(): Promise<PickedDocument | null> {
    const doc = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });

    if (doc.type !== 'success') {
      return null;
    }

    return {
      name: doc.name || 'firmware.bin',
      mimeType: doc.mimeType || 'application/octet-stream',
      size: doc.size || 0,
      uri: doc.uri,
    };
  }

  async function convertUriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return response.blob();
  }

  function uploadToPresignedUrl(options: UploadOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('PUT', options.url);
      xhr.setRequestHeader('Content-Type', options.contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress(event.loaded / event.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload error'));

      xhr.send(options.blob);
    });
  }

  async function registerFirmwareMetadata(blobUrl: string, size: number): Promise<void> {
    await apiPOST('/api/v1/firmwares', {
      version: 'vX.Y.Z',
      model: 'modelX',
      blob_url: blobUrl,
      checksum: 'sha256:TODO',
      size,
      signed_by: 'ci-signing-key',
    });
  }

  async function handleUploadWorkflow() {
    setUploading(true);

    try {
      const document = await pickDocument();
      if (!document) return;

      const presigned: PresignedUpload = await presignUpload(
        document.name,
        document.mimeType,
        document.size
      );

      const blob = await convertUriToBlob(document.uri);

      await uploadToPresignedUrl({
        url: presigned.upload_url,
        blob,
        contentType: document.mimeType,
        onProgress: setProgress,
      });

      await registerFirmwareMetadata(presigned.blob_url, document.size);

      alert('Upload complete');
      navigation.goBack();
    } catch (error: any) {
      alert('Error: ' + (error.message || error));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <View style={{ padding: 16 }}>
      <Button
        title={uploading ? 'Uploading...' : 'Pick & Upload Firmware'}
        onPress={handleUploadWorkflow}
        disabled={uploading}
      />
      <Text>Progress: {(progress * 100).toFixed(1)}%</Text>
    </View>
  );
}
