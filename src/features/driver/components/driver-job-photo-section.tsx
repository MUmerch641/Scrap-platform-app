import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

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
        <View style={styles.grid}>
          {categoryPhotos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              uri={photo.signedUrl}
              label={`${title.slice(0, -1)} ${index + 1}`}
              status="uploaded"
              onPress={() => photo.signedUrl && onPreview(photo.signedUrl, `${title.slice(0, -1)} ${index + 1}`)}
              colors={colors}
            />
          ))}
          {categoryPending.map((photo, index) => (
            <View key={photo.id} style={styles.pendingItem}>
              <PhotoTile
                uri={photo.uri}
                label={`${title.slice(0, -1)} pending ${index + 1}`}
                status={photo.status}
                onPress={() => onPreview(photo.uri, `${title.slice(0, -1)} pending ${index + 1}`)}
                colors={colors}
                compact
              />
              <View style={styles.pendingActions}>
                <Pressable onPress={() => onPreview(photo.uri, `${title.slice(0, -1)} pending ${index + 1}`)} accessibilityRole="button">
                  <Text style={[styles.pendingActionText, { color: colors.primary }]}>Preview</Text>
                </Pressable>
                {photo.status === 'failed' ? (
                  <Pressable onPress={() => onRetry(photo)} accessibilityRole="button">
                    <Text style={[styles.pendingActionText, { color: colors.primary }]}>Retry</Text>
                  </Pressable>
                ) : null}
                {photo.status !== 'uploading' ? (
                  <Pressable onPress={() => onRemove(photo)} accessibilityRole="button">
                    <Text style={[styles.pendingActionText, { color: colors.danger }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
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

function PhotoTile({ uri, label, status, onPress, colors, compact = false }: { uri: string | null; label: string; status: 'uploaded' | PendingDriverJobPhoto['status']; onPress?: () => void; colors: (typeof semanticColors)[keyof typeof semanticColors]; compact?: boolean }) {
  const isFailed = status === 'failed';
  const isPending = status === 'uploading' || status === 'preparing';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${label}, ${isFailed ? 'upload failed, retry' : status}`}
      style={({ pressed }) => [styles.tile, compact && styles.compactTile, { borderColor: isFailed ? colors.danger : colors.border, backgroundColor: colors.background, opacity: pressed ? 0.78 : 1 }]}
    >
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <Ionicons name="image-outline" size={26} color={colors.textMuted} />}
      <View style={[styles.tileShade, isFailed && styles.failedShade]} />
      {isPending ? <ActivityIndicator color={brandColors.white} /> : <Ionicons name={isFailed ? 'refresh-circle' : 'checkmark-circle'} size={24} color={isFailed ? brandColors.white : '#B9F5D2'} />}
      <Text numberOfLines={1} style={styles.tileStatus}>{isFailed ? 'Tap to retry' : isPending ? 'Uploading' : 'Uploaded'}</Text>
    </Pressable>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '30.8%', aspectRatio: 0.92, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.lg },
  compactTile: { width: '100%' },
  pendingItem: { width: '30.8%', gap: spacing.xs },
  pendingActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  pendingActionText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: 10 },
  tileShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,45,69,0.34)' },
  failedShade: { backgroundColor: 'rgba(127,29,29,0.66)' },
  tileStatus: { color: brandColors.white, fontFamily: typography.fontFamily.bodyBold, fontSize: 10 },
  empty: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  emptyText: { flex: 1, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs },
});
