import { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Category, CategoryService } from '../../services/category.service';
import { colors, getCategoryIcon, radius, spacing, shadow } from '../../theme';
import { confirmAction, getErrorMessage } from '../../utils/format';
import { ErrorState, Loading, EmptyState } from '../../components/ui/common';

const AVAILABLE_ICONS = [
  'fast-food-outline', 'cart-outline', 'car-outline', 'bus-outline', 'airplane-outline',
  'home-outline', 'bulb-outline', 'water-outline', 'flash-outline', 'wifi-outline',
  'bag-handle-outline', 'shirt-outline', 'fitness-outline', 'medkit-outline', 'school-outline',
  'cash-outline', 'card-outline', 'wallet-outline', 'trending-up-outline', 'briefcase-outline',
  'gift-outline', 'game-controller-outline', 'cafe-outline', 'paw-outline', 'color-palette-outline',
  'musical-notes-outline', 'heart-outline', 'construct-outline', 'desktop-outline', 'phone-portrait-outline',
  'bicycle-outline', 'book-outline', 'camera-outline', 'football-outline', 'flower-outline', 'barbell-outline'
] as const;

export default function SettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState<string>('list-outline');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await CategoryService.getAll();
      setCategories(data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const openAddModal = () => {
    setEditId(null);
    setCatName('');
    setCatIcon(AVAILABLE_ICONS[0]);
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditId(cat.id);
    setCatName(cat.name);
    // If it has an icon, use it, otherwise fallback to the mapped icon
    const fallback = getCategoryIcon(cat.name);
    setCatIcon(cat.icon || (AVAILABLE_ICONS.includes(fallback as any) ? fallback : AVAILABLE_ICONS[0]));
    setShowModal(true);
  };

  const handleSave = async () => {
    const name = catName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      if (editId) {
        await CategoryService.update(editId, { name, icon: catIcon });
      } else {
        await CategoryService.create({ name, type: activeTab, icon: catIcon });
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmAction('Hapus Kategori?', 'Transaksi yang menggunakan kategori ini akan ikut terhapus atau error. Yakin?')) return;
    setLoading(true);
    try {
      await CategoryService.delete(id);
      loadData();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e));
      setLoading(false);
    }
  };

  if (loading && categories.length === 0) return <Loading />;
  if (error) return <View style={styles.center}><ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} /></View>;

  const filtered = categories.filter(c => c.type === activeTab);
  const tintColor = activeTab === 'INCOME' ? colors.income : colors.expense;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tabs}>
          <Pressable onPress={() => setActiveTab('EXPENSE')} style={[styles.tab, activeTab === 'EXPENSE' && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === 'EXPENSE' && styles.tabTextActive]}>Pengeluaran</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('INCOME')} style={[styles.tab, activeTab === 'INCOME' && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === 'INCOME' && styles.tabTextActive]}>Pemasukan</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="folder-open-outline" title="Kosong" message="Belum ada kategori" />}
        renderItem={({ item }) => {
          const iconName = (item.icon || getCategoryIcon(item.name)) as any;
          return (
            <View style={styles.catItem}>
              <View style={styles.catLeft}>
                <View style={[styles.iconWrap, { backgroundColor: tintColor + '20' }]}>
                  <Ionicons name={iconName} size={18} color={tintColor} />
                </View>
                <Text style={styles.catName}>{item.name}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => openEditModal(item)} hitSlop={10} style={styles.actionBtn}>
                  <Ionicons name="pencil-outline" size={18} color={colors.muted} />
                </Pressable>
                <Pressable onPress={() => handleDelete(item.id)} hitSlop={10} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.expense} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footer}>
        <Pressable onPress={openAddModal} style={[styles.addBtn, { backgroundColor: tintColor }]}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>Tambah Kategori {activeTab === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}</Text>
        </Pressable>
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Edit Kategori' : 'Tambah Kategori'}</Text>
              <Pressable onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>

            <Text style={styles.label}>Nama Kategori</Text>
            <TextInput
              value={catName}
              onChangeText={setCatName}
              placeholder="Contoh: Makan Siang"
              style={styles.input}
              maxLength={30}
              autoFocus
            />

            <Text style={styles.label}>Pilih Ikon</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setCatIcon(icon)}
                  style={[styles.iconSelect, catIcon === icon && { backgroundColor: tintColor, borderColor: tintColor }]}
                >
                  <Ionicons name={icon} size={22} color={catIcon === icon ? colors.white : colors.muted} />
                </Pressable>
              ))}
            </View>

            <Pressable onPress={handleSave} disabled={!catName.trim() || submitting} style={[styles.saveBtn, { backgroundColor: tintColor }, (!catName.trim() || submitting) && { opacity: 0.5 }]}>
              <Text style={styles.saveBtnText}>{submitting ? 'Menyimpan...' : 'Simpan Kategori'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center' },
  header: { padding: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: radius.md },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.white, ...shadow },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.text },
  list: { padding: spacing.lg, paddingBottom: 20 },
  catItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { padding: 4 },
  footer: { backgroundColor: colors.white, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radius.md, gap: spacing.sm },
  addBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, fontSize: 15 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.xl },
  iconSelect: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  saveBtn: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
