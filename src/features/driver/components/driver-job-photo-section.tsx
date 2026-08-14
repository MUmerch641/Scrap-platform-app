import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { DriverJobPhoto, DriverJobPhotoType, PendingDriverJobPhoto } from '../types';
import { semanticColors, spacing, typography } from '@/shared/theme';

interface Props { title: string; photoType: DriverJobPhotoType; photos: DriverJobPhoto[]; pending: PendingDriverJobPhoto[]; canAdd: boolean; onTakePhoto: () => void; onChoosePhoto: () => void; onRetry: (photo: PendingDriverJobPhoto) => void; onPreview: (uri: string, label: string) => void; }

export function DriverJobPhotoSection({ title, photoType, photos, pending, canAdd, onTakePhoto, onChoosePhoto, onRetry, onPreview }: Props) {
  const colors = semanticColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const categoryPhotos = photos.filter((photo) => photo.photoType === photoType);
  const categoryPending = pending.filter((photo) => photo.photoType === photoType);
  return <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {canAdd ? <View style={styles.actions}><PhotoAction label="Take Photo" icon="camera-outline" color={colors.accent} onPress={onTakePhoto} accessibilityLabel={`Take ${photoType} photo`} /><PhotoAction label="Choose from Library" icon="images-outline" color={colors.accent} onPress={onChoosePhoto} accessibilityLabel={`Choose ${photoType} photo from library`} /></View> : null}
    {!canAdd && categoryPhotos.length === 0 ? <Text style={[styles.empty, { color: colors.textMuted }]}>No photos recorded.</Text> : null}
    {(categoryPhotos.length > 0 || categoryPending.length > 0) ? <View style={styles.grid}>
      {categoryPhotos.map((photo, index) => <PhotoTile key={photo.id} uri={photo.signedUrl} label={`${title.slice(0, -1)} ${index + 1}`} status="Uploaded" onPress={() => photo.signedUrl && onPreview(photo.signedUrl, `${title.slice(0, -1)} ${index + 1}`)} colors={colors} />)}
      {categoryPending.map((photo, index) => <PhotoTile key={photo.id} uri={photo.uri} label={`${title.slice(0, -1)} pending ${index + 1}`} status={photo.status === 'failed' ? 'Failed' : photo.status === 'uploading' ? 'Uploading' : 'Preparing'} onPress={photo.status === 'failed' ? () => onRetry(photo) : undefined} colors={colors} />)}
    </View> : null}
  </View>;
}

function PhotoAction({ label, icon, color, onPress, accessibilityLabel }: { label: string; icon: 'camera-outline' | 'images-outline'; color: string; onPress: () => void; accessibilityLabel: string }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.action, { borderColor: color }]}><Ionicons name={icon} size={18} color={color} /><Text style={[styles.actionText, { color }]}>{label}</Text></Pressable>; }
function PhotoTile({ uri, label, status, onPress, colors }: { uri: string | null; label: string; status: string; onPress?: () => void; colors: (typeof semanticColors)[keyof typeof semanticColors] }) { return <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="imagebutton" accessibilityLabel={`${label}, ${status}`} style={[styles.tile, { borderColor: colors.border, backgroundColor: colors.background }]}>{uri ? <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" transition={120} /> : <Ionicons name="image-outline" size={24} color={colors.textMuted} />}<Text numberOfLines={1} style={[styles.status, { color: status === 'Failed' ? colors.danger : colors.textMuted }]}>{status === 'Failed' ? 'Retry' : status}</Text></Pressable>; }
const styles = StyleSheet.create({ section: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm }, title: { fontFamily: typography.fontFamily.headingSemibold, fontSize: typography.fontSize.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, action: { minHeight: 44, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: 8 }, actionText: { fontFamily: typography.fontFamily.bodySemibold, fontSize: typography.fontSize.sm }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, tile: { width: 88, minHeight: 104, borderWidth: 1, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, thumbnail: { width: 86, height: 78 }, status: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, fontFamily: typography.fontFamily.bodyMedium, fontSize: typography.fontSize.xs }, empty: { fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.sm } });
