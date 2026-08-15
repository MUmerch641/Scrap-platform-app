import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { brandColors, radius, semanticColors, spacing, typography } from '@/shared/theme';

import { DriverJobPhoto, DriverJobPhotoType, PendingDriverJobPhoto } from '../types';

interface Props {
  title: string;
  photoType: DriverJobPhotoType;
  photos: DriverJobPhoto[];
  pending: PendingDriverJobPhoto[];
  canAdd: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRetry: (photo: PendingDriverJobPhoto) => void;
  onRemove: (photo: PendingDriverJobPhoto) => void;
  onPreview: (uri: string, label: string) => void;
}

export function DriverJobPhotoSection({ title, photoType, photos, pending, canAdd, onTakePhoto, onChoosePhoto, onRetry, onRemove, onPreview }: Props) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const categoryPhotos = photos.filter((photo) => photo.photoType === photoType);
  const categoryPending = pending.filter((photo) => photo.photoType === photoType);
  const hasEvidence = categoryPhotos.length > 0;

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <Ionicons name={photoType === 'collection' ? 'camera-outline' : 'business-outline'} size={20} color={colors.accent} />
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{photoType === 'collection' ? 'Document material at pickup' : 'Confirm evidence at the yard'}</Text>
        </View>
        <View style={[styles.evidenceBadge, { backgroundColor: hasEvidence ? 'rgba(40,99,71,0.12)' : colors.background }]}>
          <Ionicons name={hasEvidence ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={hasEvidence ? colors.success : colors.textMuted} />
          <Text style={[styles.evidenceText, { color: hasEvidence ? colors.success : colors.textMuted }]}>{hasEvidence ? `${categoryPhotos.length} added` : 'None yet'}</Text>
        </View>
      </View>

      {canAdd ? (
        <View style={styles.actions}>
          <PhotoAction label="Take Photo" icon="camera" primary color={colors.primary} onColor={colors.onPrimary} onPress={onTakePhoto} accessibilityLabel={`Take ${photoType} photo`} />
          <PhotoAction label="Photo Library" icon="images-outline" color={colors.primary} onPress={onChoosePhoto} accessibilityLabel={`Choose ${photoType} photo from library`} />
        </View>
      ) : null}

      {!canAdd && !hasEvidence ? (
        <View style={[styles.empty, { backgroundColor: colors.background }]}>
          <Ionicons name="image-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No evidence was recorded for this stage.</Text>
        </View>
      ) : null}

      {hasEvidence || categoryPending.length > 0 ? (
        <View style={styles.photoList}>
          {categoryPhotos.map((photo, index) => (
            <PhotoRow
              key={photo.id}
              uri={photo.signedUrl}
              label={`${title.slice(0, -1)} ${index + 1}`}
              status="uploaded"
              onPress={() => photo.signedUrl && onPreview(photo.signedUrl, `${title.slice(0, -1)} ${index + 1}`)}
              colors={colors}
            />
          ))}
          {categoryPending.map((photo, index) => (
            <PhotoRow
              key={photo.id}
              uri={photo.uri}
              label={`${title.slice(0, -1)} ${index + 1}`}
              status={photo.status}
              error={photo.error}
              onPress={() => onPreview(photo.uri, `${title.slice(0, -1)} ${index + 1}`)}
              onRetry={photo.status === 'failed' ? () => onRetry(photo) : undefined}
              onRemove={photo.status !== 'uploading' ? () => onRemove(photo) : undefined}
              colors={colors}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PhotoAction({ label, icon, primary = false, color, onColor = brandColors.white, onPress, accessibilityLabel }: { label: string; icon: 'camera' | 'images-outline'; primary?: boolean; color: string; onColor?: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.action, { borderColor: color, backgroundColor: primary ? color : 'transparent', opacity: pressed ? 0.72 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={primary ? onColor : color} />
      <Text style={[styles.actionText, { color: primary ? onColor : color }]}>{label}</Text>
    </Pressable>
  );
}

function PhotoRow({ uri, label, status, error, onPress, onRetry, onRemove, colors }: {
  uri: string | null;
  label: string;
  status: 'uploaded' | PendingDriverJobPhoto['status'];
  error?: string;
  onPress: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  colors: (typeof semanticColors)[keyof typeof semanticColors];
}) {
  const isFailed = status === 'failed';
  const isPending = status === 'uploading' || status === 'preparing';
  return (
    <View style={[styles.photoRow, { borderColor: colors.border }]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Preview ${label}`}>
        {uri ? <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" transition={120} /> : <View style={[styles.thumbnail, styles.imageFallback, { backgroundColor: colors.background }]}><Ionicons name="image-outline" size={24} color={colors.textMuted} /></View>}
      </Pressable>
      <View style={styles.photoDetails}>
        <Text style={[styles.photoName, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.photoStatus, { color: isFailed ? colors.danger : colors.textMuted }]}>
          {isFailed ? error ?? 'Upload failed. Please retry or remove it.' : isPending ? 'Uploading…' : 'Uploaded'}
        </Text>
        <View style={styles.photoRowActions}>
          <Pressable onPress={onPress} accessibilityRole="button"><Text style={[styles.photoActionText, { color: colors.primary }]}>Preview</Text></Pressable>
          {onRetry ? <Pressable onPress={onRetry} accessibilityRole="button"><Text style={[styles.photoActionText, { color: colors.primary }]}>Retry</Text></Pressable> : null}
          {onRemove ? <Pressable onPress={onRemove} accessibilityRole="button"><Text style={[styles.photoActionText, { color: colors.danger }]}>Remove</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md, gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headingCopy: { flex: 1, gap: 2 },
  title: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md },
  subtitle: { fontFamily: typography.fontFamily.body, fontSize: 11 },
  evidenceBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing.sm },
  evidenceText: { fontFamily: typography.fontFamily.bodyBold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  actionText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  photoList: { gap: spacing.sm },
  photoRow: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm },
  thumbnail: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: '#D9D9D9' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  photoDetails: { flex: 1, gap: 2, justifyContent: 'center' },
  photoName: { fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.sm },
  photoStatus: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xs },
  photoRowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  photoActionText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.xs },
  empty: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  emptyText: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs },
});
