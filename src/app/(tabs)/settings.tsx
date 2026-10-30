import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Category, CategoryService } from '../../services/category.service';
import { Transaction, TransactionService } from '../../services/transaction.service';
import { Budget, BudgetService } from '../../services/budget.service';
import { NotificationService } from '../../services/notification.service';
import { useUserName } from '../../services/profile.service';
import { usePacingConfig } from '../../services/pacing.service';
import { colors, getCategoryIcon, radius, spacing, shadow } from '../../theme';
import { confirmAction, formatRupiah, formatThousands, getErrorMessage, getMonthRange } from '../../utils/format';
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
  const [userName, setUserName] = useUserName();
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthTransactionsCount, setMonthTransactionsCount] = useState(0);
  const [activeBudgetsCount, setActiveBudgetsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile Name Modal State
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  // Wallets Master Management Modal State (One unified wallet list)
  const [walletsModalVisible, setWalletsModalVisible] = useState(false);

  // Preferences States
  const [startOfWeek, setStartOfWeek] = useState<'Senin' | 'Minggu'>('Senin');

  // Pacing Settings State
  const [pacingConfig, setPacingConfig] = usePacingConfig();
  const [pacingModalVisible, setPacingModalVisible] = useState(false);
  const [tempPacingMode, setTempPacingMode] = useState<'AUTO' | 'CUSTOM'>(pacingConfig.mode);
  const [tempPacingAmount, setTempPacingAmount] = useState(String(pacingConfig.customDailyLimit));

  // Category Add / Edit Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [catIcon, setCatIcon] = useState<string>('wallet-outline');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const now = new Date();
      const [data, txList, budgetList] = await Promise.all([
        CategoryService.getAll().catch(() => [] as Category[]),
        TransactionService.getAll(getMonthRange(now)).catch(() => [] as Transaction[]),
        BudgetService.getAll(now.getMonth() + 1, now.getFullYear()).catch(() => [] as Budget[]),
      ]);
      setCategories(data);
      setMonthTransactionsCount(txList.length);
      setActiveBudgetsCount(budgetList.filter((b) => b.amount > 0).length);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const openEditNameModal = () => {
    setNameInput(userName);
    setNameModalVisible(true);
  };

  const handleSaveName = () => {
    const clean = nameInput.trim();
    if (!clean) {
      Alert.alert('Nama Tidak Boleh Kosong', 'Silakan masukkan nama profil Anda.');
      return;
    }
    setUserName(clean);
    setNameModalVisible(false);
  };

  const openAddWalletModal = () => {
    setEditId(null);
    setCatName('');
    setCatType('EXPENSE');
    setCatIcon(AVAILABLE_ICONS[0]);
    setShowCatModal(true);
  };

  const openEditWalletModal = (cat: Category) => {
    setEditId(cat.id);
    setCatName(cat.name);
    setCatType(cat.type);
    const fallback = getCategoryIcon(cat.name);
    setCatIcon(cat.icon || (AVAILABLE_ICONS.includes(fallback as (typeof AVAILABLE_ICONS)[number]) ? fallback : AVAILABLE_ICONS[0]));
    setShowCatModal(true);
  };

  const handleSaveWallet = async () => {
    const name = catName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      if (editId) {
        await CategoryService.update(editId, { name, icon: catIcon });
      } else {
        await CategoryService.create({ name, type: catType, icon: catIcon });
      }
      setShowCatModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWallet = async (id: string, name: string) => {
    const ok = await confirmAction(
      'Hapus Dompet Ini?',
      `Dompet "${name}" beserta seluruh riwayat transaksi dan pengaturan plafonnya akan dihapus. Lanjutkan?`,
    );
    if (!ok) return;

    setLoading(true);
    try {
      await CategoryService.delete(id);
      loadData();
    } catch (e) {
      Alert.alert('Gagal Menghapus', getErrorMessage(e));
      setLoading(false);
    }
  };

  if (loading && categories.length === 0) return <Loading />;
  if (error) {
    return (
      <View style={styles.center}>
        <ErrorState message={error} onRetry={() => { setLoading(true); loadData(); }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Header & Card Profil Pengguna (Bebas Edit Nama) */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileSubtitle}>Pengguna Catetan Duit</Text>
          </View>
          <Pressable
            onPress={openEditNameModal}
            style={styles.editNameBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ubah nama profil"
          >
            <Ionicons name="pencil" size={14} color={colors.primary} />
            <Text style={styles.editNameBtnText}>Ubah Nama</Text>
          </Pressable>
        </View>

        <View style={styles.profileStatsRow}>
          <View style={styles.profileStatCol}>
            <Text style={styles.profileStatNum}>{categories.length}</Text>
            <Text style={styles.profileStatLabel}>Dompet Aktif</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStatCol}>
            <Text style={[styles.profileStatNum, { color: colors.blue500 }]}>{monthTransactionsCount}</Text>
            <Text style={styles.profileStatLabel}>Transaksi Bulan Ini</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStatCol}>
            <Text style={[styles.profileStatNum, { color: colors.income }]}>{activeBudgetsCount}</Text>
            <Text style={styles.profileStatLabel}>Plafon Aktif</Text>
          </View>
        </View>
      </View>

      {/* 2. Satu Master Card untuk Kelola Dompet Keuangan */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Kelola Dompet Keuangan</Text>
        <Text style={styles.sectionSubtitle}>
          Seluruh pos dompet pengeluaran dan pemasukan dalam satu kesatuan
        </Text>

        <Pressable
          onPress={() => setWalletsModalVisible(true)}
          style={styles.masterWalletCard}
          accessibilityRole="button"
          accessibilityLabel="Buka kelola dompet dan kategori"
        >
          <View style={styles.masterCardIconWrap}>
            <Ionicons name="wallet-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterCardTitle}>Kelola Dompet & Kategori</Text>
            <Text style={styles.masterCardDesc}>
              Buka untuk menambah, mengedit, atau menghapus pos dompet serbaguna
            </Text>
            <View style={styles.masterBadgeRow}>
              <View style={styles.masterCountBadge}>
                <Text style={styles.masterCountBadgeText}>{categories.length} Dompet Aktif</Text>
              </View>
              <Text style={styles.masterTapHint}>Ketuk untuk kelola</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.inkTertiary} />
        </Pressable>
      </View>

      {/* 3. Preferensi Finansial & Tampilan */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Preferensi Tampilan</Text>
        <Text style={styles.sectionSubtitle}>Pengaturan format dan visual antarmuka</Text>

        <View style={styles.settingsGroupCard}>
          <View style={styles.settingItemRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingItemTitle}>Awal Hari Mingguan</Text>
              <Text style={styles.settingItemSubtitle}>Pola pembagian grafik statistik harian</Text>
            </View>
            <Pressable
              onPress={() => setStartOfWeek(startOfWeek === 'Senin' ? 'Minggu' : 'Senin')}
              style={styles.togglePill}
            >
              <Text style={styles.togglePillText}>{startOfWeek}</Text>
              <Ionicons name="swap-horizontal" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 4. Notifikasi Kuota Anggaran & Pengingat Pintar */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Notifikasi & Pengingat Pintar</Text>
        <Text style={styles.sectionSubtitle}>
          Peringatan otomatis langsung ke ponsel saat mendekati batas anggaran atau saldo menipis
        </Text>

        <View style={styles.settingsGroupCard}>
          {/* Item 1: Peringatan Kuota Plafon */}
          <View style={styles.settingItemRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingItemTitle}>Peringatan Kuota Plafon</Text>
              <Text style={styles.settingItemSubtitle}>Pemberitahuan saat belanja 80% & 100% plafon</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Aktif</Text>
            </View>
          </View>

          <View style={styles.settingItemDivider} />

          {/* Item 2: Peringatan Saldo Menipis */}
          <View style={styles.settingItemRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingItemTitle}>Peringatan Saldo Menipis</Text>
              <Text style={styles.settingItemSubtitle}>Pemberitahuan saat saldo kas dompet &le; Rp 50.000 atau minus</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Aktif</Text>
            </View>
          </View>

          <View style={styles.settingItemDivider} />

          {/* Item 3: Batas Belanja Harian (Pacing) */}
          <View style={styles.settingItemRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="speedometer-outline" size={18} color={colors.blue500} />
            </View>
            <View style={{ flex: 1, marginRight: spacing.xs }}>
              <Text style={styles.settingItemTitle}>Batas Belanja Harian</Text>
              <Text style={styles.settingItemSubtitle}>
                {pacingConfig.mode === 'CUSTOM'
                  ? `Mode Kustom: ${formatRupiah(pacingConfig.customDailyLimit)}/hari`
                  : 'Mode Otomatis: Dihitung dari sisa plafon'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setTempPacingMode(pacingConfig.mode);
                setTempPacingAmount(String(pacingConfig.customDailyLimit));
                setPacingModalVisible(true);
              }}
              style={styles.settingPillBtn}
              accessibilityRole="button"
              accessibilityLabel="Atur batas belanja harian"
            >
              <Ionicons name="options-outline" size={13} color={colors.primary} />
              <Text style={styles.settingPillBtnText}>Atur</Text>
            </Pressable>
          </View>

          <View style={styles.settingItemDivider} />

          {/* Interactive Test Notifications Header */}
          <View style={{ marginTop: 6, marginBottom: 8 }}>
            <Text style={styles.testSectionTitle}>Uji Coba Notifikasi ke Ponsel</Text>
            <Text style={styles.testSectionSubtitle}>Ketuk tombol untuk menguji tampilan notifikasi di layar Anda</Text>
          </View>

          {/* 4 Test Buttons Row */}
          <View style={styles.testButtonsGrid}>
            <Pressable
              onPress={() => NotificationService.sendTestAlert('budget_warning')}
              style={[styles.testChipBtn, { borderColor: colors.warning }]}
              accessibilityRole="button"
              accessibilityLabel="Uji coba notifikasi waspada 80 persen"
            >
              <Ionicons name="warning-outline" size={13} color={colors.warning} />
              <Text style={[styles.testChipText, { color: colors.warning }]}>Plafon 80%</Text>
            </Pressable>

            <Pressable
              onPress={() => NotificationService.sendTestAlert('budget_exceeded')}
              style={[styles.testChipBtn, { borderColor: colors.expense }]}
              accessibilityRole="button"
              accessibilityLabel="Uji coba notifikasi plafon 100 persen"
            >
              <Ionicons name="alert-circle-outline" size={13} color={colors.expense} />
              <Text style={[styles.testChipText, { color: colors.expense }]}>Plafon 100%</Text>
            </Pressable>

            <Pressable
              onPress={() => NotificationService.sendTestAlert('low_balance')}
              style={[styles.testChipBtn, { borderColor: colors.danger }]}
              accessibilityRole="button"
              accessibilityLabel="Uji coba notifikasi saldo menipis"
            >
              <Ionicons name="wallet-outline" size={13} color={colors.danger} />
              <Text style={[styles.testChipText, { color: colors.danger }]}>Saldo Tipis</Text>
            </Pressable>

            <Pressable
              onPress={() => NotificationService.sendTestAlert('daily_limit')}
              style={[styles.testChipBtn, { borderColor: colors.blue500 }]}
              accessibilityRole="button"
              accessibilityLabel="Uji coba notifikasi batas belanja harian"
            >
              <Ionicons name="flash-outline" size={13} color={colors.blue500} />
              <Text style={[styles.testChipText, { color: colors.blue500 }]}>Batas Harian</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Modal: Ubah Nama Profil Pengguna */}
      <Modal visible={nameModalVisible} transparent animationType="fade" onRequestClose={() => setNameModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>Ubah Nama Profil</Text>
                <Text style={styles.dialogSubtitle}>Tulis nama panggilan atau nama akunmu</Text>
              </View>
              <Pressable onPress={() => setNameModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Contoh: Budi / Boss"
              style={styles.input}
              maxLength={25}
              autoFocus
            />

            <View style={styles.dialogBtnRow}>
              <Pressable onPress={() => setNameModalVisible(false)} style={styles.dialogCancelBtn}>
                <Text style={styles.dialogCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable onPress={handleSaveName} style={styles.dialogSaveBtn}>
                <Text style={styles.dialogSaveBtnText}>Simpan Nama</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Atur Pacing Belanja Harian */}
      <Modal visible={pacingModalVisible} transparent animationType="fade" onRequestClose={() => setPacingModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="speedometer-outline" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>Batas Belanja Harian</Text>
                <Text style={styles.dialogSubtitle}>Tentukan batas rekomendasi belanja harianmu</Text>
              </View>
              <Pressable onPress={() => setPacingModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {/* Opsi 1: Otomatis */}
            <Pressable
              onPress={() => setTempPacingMode('AUTO')}
              style={[
                styles.pacingModeOption,
                tempPacingMode === 'AUTO' && styles.pacingModeOptionActive,
              ]}
            >
              <View style={[styles.pacingRadioCircle, tempPacingMode === 'AUTO' && styles.pacingRadioCircleActive]}>
                {tempPacingMode === 'AUTO' && <View style={styles.pacingRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.pacingModeTitle}>Otomatis (Berdasarkan Plafon)</Text>
                  <View style={styles.pacingRecBadge}>
                    <Text style={styles.pacingRecBadgeText}>Rekomendasi</Text>
                  </View>
                </View>
                <Text style={styles.pacingModeDesc}>
                  Dihitung dinamis: Sisa plafon dibagi sisa hari di bulan ini.
                </Text>
              </View>
            </Pressable>

            {/* Opsi 2: Kustom Manual */}
            <Pressable
              onPress={() => setTempPacingMode('CUSTOM')}
              style={[
                styles.pacingModeOption,
                tempPacingMode === 'CUSTOM' && styles.pacingModeOptionActive,
              ]}
            >
              <View style={[styles.pacingRadioCircle, tempPacingMode === 'CUSTOM' && styles.pacingRadioCircleActive]}>
                {tempPacingMode === 'CUSTOM' && <View style={styles.pacingRadioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pacingModeTitle}>Kustom (Nominal Tetap Manual)</Text>
                <Text style={styles.pacingModeDesc}>
                  Tetapkan target batas belanja harian tetap sesuai kehendak Anda.
                </Text>
              </View>
            </Pressable>

            {/* Input Nominal bila Mode Kustom dipilih */}
            {tempPacingMode === 'CUSTOM' && (
              <View style={styles.pacingInputBoxWrap}>
                <Text style={styles.pacingInputLabel}>Nominal Batas Belanja Harian</Text>
                <View style={styles.pacingAmountRow}>
                  <Text style={styles.pacingAmountPrefix}>Rp</Text>
                  <TextInput
                    value={formatThousands(tempPacingAmount)}
                    onChangeText={(t) => setTempPacingAmount(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder="Contoh: 50.000"
                    placeholderTextColor={colors.inkTertiary}
                    style={styles.pacingAmountInput}
                  />
                  <Text style={styles.pacingAmountUnit}>/hari</Text>
                </View>

                {/* Quick suggestions chips */}
                <View style={styles.pacingChipsRow}>
                  {[25000, 50000, 75000, 100000].map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => setTempPacingAmount(String(amt))}
                      style={styles.pacingChipBtn}
                    >
                      <Text style={styles.pacingChipText}>{formatRupiah(amt)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.dialogBtnRow}>
              <Pressable onPress={() => setPacingModalVisible(false)} style={styles.dialogCancelBtn}>
                <Text style={styles.dialogCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const cleanAmt = Number(tempPacingAmount.replace(/\D/g, ''));
                  setPacingConfig({
                    mode: tempPacingMode,
                    customDailyLimit: cleanAmt > 0 ? cleanAmt : 50000,
                  });
                  setPacingModalVisible(false);
                }}
                style={styles.dialogSaveBtn}
              >
                <Text style={styles.dialogSaveBtnText}>Simpan Pacing</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Penuh: Kelola Dompet (Satu Kesatuan Serbaguna) */}
      <Modal visible={walletsModalVisible} animationType="slide" onRequestClose={() => setWalletsModalVisible(false)}>
        <View style={styles.fullModalContainer}>
          <View style={styles.fullModalHeader}>
            <Pressable onPress={() => setWalletsModalVisible(false)} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullModalTitle}>Kelola Dompet Keuangan</Text>
              <Text style={styles.fullModalSubtitle}>
                Daftar seluruh dompet serbaguna akunmu
              </Text>
            </View>
          </View>

          {/* Tombol Tambah Dompet Baru */}
          <View style={styles.addWalletBtnWrap}>
            <Pressable
              onPress={openAddWalletModal}
              style={styles.addWalletBtn}
            >
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.addWalletBtnText}>+ Buat Dompet Kategori Baru</Text>
            </Pressable>
          </View>

          {/* List Dompet Serbaguna */}
          <ScrollView contentContainerStyle={styles.walletsListContent}>
            {categories.length === 0 ? (
              <EmptyState
                icon="folder-open-outline"
                title="Belum Ada Dompet"
                message="Tekan tombol di atas untuk membuat dompet kategori baru."
              />
            ) : (
              categories.map((item) => {
                const iconName = (item.icon || getCategoryIcon(item.name)) as any;
                return (
                  <View key={item.id} style={styles.walletItemCard}>
                    <View style={styles.walletItemLeft}>
                      <View style={styles.walletItemIconWrap}>
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.walletItemName} numberOfLines={1}>
                          Dompet {item.name}
                        </Text>
                        <View style={styles.walletTagRow}>
                          <View style={styles.walletTypeTag}>
                            <Text style={styles.walletTypeTagText}>
                              Dompet Serbaguna (Masuk & Keluar)
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Tombol Aksi Khusus: Ubah & Hapus */}
                    <View style={styles.walletActions}>
                      <Pressable
                        onPress={() => openEditWalletModal(item)}
                        style={styles.actionBtnEdit}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Ubah dompet ${item.name}`}
                      >
                        <Ionicons name="pencil" size={13} color={colors.primary} />
                        <Text style={styles.actionBtnEditText}>Ubah</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteWallet(item.id, item.name)}
                        style={styles.actionBtnDelete}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus dompet ${item.name}`}
                      >
                        <Ionicons name="trash-outline" size={13} color={colors.expense} />
                        <Text style={styles.actionBtnDeleteText}>Hapus</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Form Tambah & Edit Dompet (Tanpa Pemilihan Tipe yang Membingungkan) */}
      <Modal visible={showCatModal} transparent animationType="fade" onRequestClose={() => setShowCatModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.catFormContent}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>
                {editId ? 'Ubah Dompet Kategori' : 'Buat Dompet Baru'}
              </Text>
              <Pressable onPress={() => setShowCatModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Nama Dompet</Text>
            <TextInput
              value={catName}
              onChangeText={setCatName}
              placeholder="Contoh: Makan, Belanja, Usaha, Gaji"
              style={styles.input}
              maxLength={30}
              autoFocus
            />

            <Text style={styles.inputLabel}>Pilih Ikon</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((icon) => {
                const isSelected = catIcon === icon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => setCatIcon(icon)}
                    style={[
                      styles.iconSelect,
                      isSelected && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={icon}
                      size={22}
                      color={isSelected ? colors.white : colors.muted}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleSaveWallet}
              disabled={!catName.trim() || submitting}
              style={[
                styles.saveWalletBtn,
                (!catName.trim() || submitting) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.saveWalletBtnText}>
                {submitting ? 'Menyimpan...' : 'Simpan Dompet'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center' },

  // Profile Card
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  profileSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  editNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  editNameBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  profileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  profileStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  profileStatNum: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  profileStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  profileStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },

  // Section General
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },

  // Master Wallet Card
  masterWalletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow,
  },
  masterCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  masterCardDesc: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  masterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  masterCountBadge: {
    backgroundColor: colors.sky100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
  },
  masterCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  masterTapHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.blue500,
  },

  // Settings Group Card
  settingsGroupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    minHeight: 44,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.chip,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  settingItemSubtitle: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginTop: 1,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  togglePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  settingItemDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  activeBadge: {
    backgroundColor: colors.incomeTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.chip,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.income,
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blue500,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  testNotifBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  testSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  testSectionSubtitle: {
    fontSize: 11,
    color: colors.inkTertiary,
    marginTop: 1,
  },
  testButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  testChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  settingPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  settingPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  pacingModeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pacingModeOptionActive: {
    backgroundColor: colors.sky100,
    borderColor: colors.primary,
  },
  pacingRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.inkTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pacingRadioCircleActive: {
    borderColor: colors.primary,
  },
  pacingRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pacingModeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  pacingRecBadge: {
    backgroundColor: colors.incomeTint,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  pacingRecBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.income,
  },
  pacingModeDesc: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  pacingInputBoxWrap: {
    backgroundColor: colors.canvas,
    borderRadius: radius.control,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pacingInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    marginBottom: 6,
  },
  pacingAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  pacingAmountPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 4,
  },
  pacingAmountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    height: '100%',
  },
  pacingAmountUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkTertiary,
    marginLeft: 4,
  },
  pacingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pacingChipBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.chip,
  },
  pacingChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
  },

  // Dialog / Edit Name Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  dialogCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dialogIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  dialogSubtitle: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 1,
  },
  input: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 15,
    color: colors.ink,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dialogCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.control,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  dialogSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.control,
  },
  dialogSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  // Full Screen Wallets Modal
  fullModalContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 6,
    borderRadius: radius.chip,
  },
  fullModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  fullModalSubtitle: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 1,
  },
  addWalletBtnWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: radius.control,
  },
  addWalletBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  walletsListContent: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  walletItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
  },
  walletItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  walletItemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  walletTagRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  walletTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.chip,
    backgroundColor: colors.sky100,
  },
  walletTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  walletActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.sky100,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.chip,
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.expenseSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.chip,
  },
  actionBtnDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.expense,
  },

  // Category Add/Edit Modal
  catFormContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    maxHeight: '90%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  iconSelect: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  saveWalletBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveWalletBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
