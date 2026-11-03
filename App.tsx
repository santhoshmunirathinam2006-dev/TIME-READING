import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Alert,
  Text,
  Platform,
  StatusBar,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from './src/components/Header';
import { TabNavigation } from './src/components/TabNavigation';
import { WorkTab } from './src/components/WorkTab';
import { TableTab } from './src/components/TableTab';
import { UploadTab } from './src/components/UploadTab';
import { ConfirmModal } from './src/components/ConfirmModal';
import { EditPriceModal } from './src/components/EditPriceModal';
import { ClearWarningModal } from './src/components/ClearWarningModal';
import { DataPermissionModal } from './src/components/DataPermissionModal';
import {
  TableRow,
  TabType,
  SearchColumn,
  ConfirmDialogState,
  UploadColumnKey,
} from './src/types';
import {
  createInitialRows,
  createInitialPrices,
  computeSortedRows,
  formatTime,
} from './src/utils/tableLogic';
import { openCsvFile, saveTableToCsv, saveToNamedFile } from './src/utils/csvHelper';
import {
  loadStateFromLocal,
  saveStateToLocal,
  clearLocalState,
  saveCurrentFileName,
  getCurrentFileName,
  saveDataPermission,
  getDataPermission,
  saveUploadUrl,
  getUploadUrl,
  saveUploadColumns,
  getUploadColumns,
} from './src/utils/storage';

const DEFAULT_UPLOAD_COLUMNS: UploadColumnKey[] = [
  'rank',
  'card_number',
  'name',
  'time',
  'price',
];

function MainApp() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  // Main Table State (1 to 500 rows)
  const [rows, setRows] = useState<TableRow[]>(() => computeSortedRows(createInitialRows(500)));
  const [prices, setPrices] = useState<string[]>(() => createInitialPrices(500));
  const [currentTab, setCurrentTab] = useState<TabType>('work');
  const [isLoading, setIsLoading] = useState(false);

  // Work Tab Input States (1. Card, 2. Time, 3. Name)
  const [cardInput, setCardInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Table Tab Search States
  const [searchColumn, setSearchColumn] = useState<SearchColumn>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Tab States (Persisted across sessions)
  const [uploadUrl, setUploadUrl] = useState('');
  const [selectedUploadColumns, setSelectedUploadColumns] = useState<UploadColumnKey[]>(
    DEFAULT_UPLOAD_COLUMNS
  );

  // Modals & Dialogs
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    visible: false,
    type: 'time',
    cardNumber: 0,
    previousValue: '',
    newValue: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Persistence & file state
  const [dataPermission, setDataPermission] = useState<boolean | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  // Recent update tracking
  const [recentEntries, setRecentEntries] = useState<TableRow[]>([]);

  // Banner Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Load persisted state & permission on startup
  useEffect(() => {
    (async () => {
      // 1. Load upload URL & selected columns (always preserved)
      const savedUrl = await getUploadUrl();
      if (savedUrl) {
        setUploadUrl(savedUrl);
      }
      const savedCols = await getUploadColumns();
      if (savedCols && savedCols.length > 0) {
        setSelectedUploadColumns(savedCols as UploadColumnKey[]);
      }

      // 2. Check data persistence permission
      const permission = await getDataPermission();
      if (permission === null) {
        // First launch — ask for permission
        setShowPermissionModal(true);
      } else {
        setDataPermission(permission);
        if (permission) {
          const stored = await loadStateFromLocal();
          if (stored.rows && stored.rows.length > 0) {
            setRows(computeSortedRows(stored.rows));
          }
          if (stored.prices && stored.prices.length > 0) {
            setPrices(stored.prices);
          }
          const fname = await getCurrentFileName();
          setCurrentFileName(fname);
        }
      }
    })();
  }, []);

  // Sync table to local storage on changes (only if permitted)
  useEffect(() => {
    if (dataPermission === true) {
      saveStateToLocal(rows, prices);
    }
  }, [rows, prices, dataPermission]);

  // --- Permission Handlers ---
  const handleAllowPermission = useCallback(async () => {
    await saveDataPermission(true);
    setDataPermission(true);
    setShowPermissionModal(false);
    showToast('Data persistence enabled');
  }, [showToast]);

  const handleDeclinePermission = useCallback(async () => {
    await saveDataPermission(false);
    setDataPermission(false);
    setShowPermissionModal(false);
    Alert.alert(
      'Persistence Disabled',
      'Your table data will not be saved between sessions. Data will be lost if the app is closed unexpectedly.',
      [{ text: 'Understood', style: 'cancel' }]
    );
  }, []);

  // Handle Refresh Button (Clears entry boxes or resets filters depending on active tab)
  const handleRefresh = useCallback(() => {
    if (currentTab === 'work') {
      setCardInput('');
      setTimeInput('');
      setNameInput('');
      showToast('All entry boxes cleared');
    } else if (currentTab === 'table') {
      setSearchQuery('');
      setSearchColumn('all');
      showToast('Search filter reset');
    } else {
      setSelectedUploadColumns(DEFAULT_UPLOAD_COLUMNS);
      saveUploadColumns(DEFAULT_UPLOAD_COLUMNS);
      showToast('Column filters reset to all');
    }
  }, [currentTab, showToast]);

  // Handle Open CSV
  const handleOpenCsv = useCallback(async () => {
    setIsLoading(true);
    const result = await openCsvFile();
    setIsLoading(false);

    if (result.success && result.rows) {
      setRows(result.rows);
      if (result.prices && result.prices.length > 0) {
        const updatedPrices = [...prices];
        result.prices.forEach((p, idx) => {
          if (idx < updatedPrices.length) {
            updatedPrices[idx] = p;
          }
        });
        setPrices(updatedPrices);
      }
      // Store opened filename for smart save
      const fname = result.fileName ?? null;
      setCurrentFileName(fname);
      await saveCurrentFileName(fname);

      showToast(result.message);
      setCurrentTab('table');
    } else if (!result.success && result.message !== 'File selection cancelled') {
      Alert.alert('Notice', result.message);
    }
  }, [prices, showToast]);

  // Smart Save: overwrite opened file OR create new timestamped file
  const handleSaveCsv = useCallback(async () => {
    setIsLoading(true);
    let result: { success: boolean; message: string };

    if (currentFileName) {
      // Overwrite same file
      result = await saveToNamedFile(currentFileName, rows, prices);
    } else {
      // No file open — create new timestamped file
      result = await saveTableToCsv(rows, prices);
    }
    setIsLoading(false);

    if (result.success) {
      showToast(currentFileName ? `Saved to "${currentFileName}"` : 'CSV export ready');
    } else {
      Alert.alert('Notice', result.message);
    }
  }, [rows, prices, currentFileName, showToast]);

  // Handle Clear Button
  const handleClearConfirm = useCallback(async () => {
    setShowClearModal(false);
    const freshRows = computeSortedRows(createInitialRows(500));
    const freshPrices = createInitialPrices(500);
    setRows(freshRows);
    setPrices(freshPrices);
    setCurrentFileName(null);
    setRecentEntries([]);
    // Wipe AsyncStorage table data
    await clearLocalState();
    showToast('Table cleared');
  }, [showToast]);

  // Update card in table and re-sort
  const commitCardUpdate = useCallback(
    (cardNum: number, newTime: number | null, newName?: string | null) => {
      setRows((prevRows) => {
        const updated = [...prevRows];
        const existingIdx = updated.findIndex((r) => r.card_number === cardNum);

        let targetRow: TableRow;
        if (existingIdx !== -1) {
          targetRow = { ...updated[existingIdx] };
          if (newTime !== null) {
            targetRow.time = Number(newTime.toFixed(2));
          }
          if (newName !== undefined && newName !== null) {
            targetRow.name = newName.trim().length > 0 ? newName.trim() : targetRow.name;
          }
          updated[existingIdx] = targetRow;
        } else {
          targetRow = {
            card_number: cardNum,
            name: newName && newName.trim().length > 0 ? newName.trim() : null,
            time: newTime !== null ? Number(newTime.toFixed(2)) : null,
            rank: null,
          };
          updated.push(targetRow);
        }

        const sorted = computeSortedRows(updated);
        const finalized = sorted.find((r) => r.card_number === cardNum);
        if (finalized) {
          setRecentEntries((prev) => [finalized, ...prev.filter((p) => p.card_number !== cardNum)].slice(0, 4));
        }

        return sorted;
      });

      // Clear entry boxes after adding
      setCardInput('');
      setTimeInput('');
      setNameInput('');
    },
    []
  );

  // Add Time Button Logic
  const handleAddTime = useCallback(() => {
    const cardNum = parseInt(cardInput.trim(), 10);
    if (isNaN(cardNum) || cardNum <= 0) {
      Alert.alert('Input Error', 'Please enter a valid Card Number.');
      return;
    }

    const trimmedTime = timeInput.trim();
    if (!trimmedTime) {
      Alert.alert('Input Error', 'Please enter the Time (e.g. 10.45).');
      return;
    }

    const parsedTime = parseFloat(trimmedTime);
    if (isNaN(parsedTime) || parsedTime <= 0) {
      Alert.alert('Input Error', 'Please enter a valid positive Time value in seconds.');
      return;
    }

    const existingCard = rows.find((r) => r.card_number === cardNum);

    if (existingCard && existingCard.time !== null && !isNaN(existingCard.time)) {
      setConfirmDialog({
        visible: true,
        type: 'time',
        cardNumber: cardNum,
        previousValue: formatTime(existingCard.time),
        newValue: parsedTime.toFixed(2),
        pendingName: nameInput,
        onConfirm: () => {
          commitCardUpdate(cardNum, parsedTime, nameInput);
          setConfirmDialog((d) => ({ ...d, visible: false }));
          showToast(`Card ${cardNum} updated: ${parsedTime.toFixed(2)}s`);
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, visible: false }));
        },
      });
    } else {
      commitCardUpdate(cardNum, parsedTime, nameInput);
      showToast(`Card ${cardNum} recorded: ${parsedTime.toFixed(2)}s`);
    }
  }, [cardInput, timeInput, nameInput, rows, commitCardUpdate, showToast]);

  // Add Name Button Logic
  const handleAddName = useCallback(() => {
    const cardNum = parseInt(cardInput.trim(), 10);
    if (isNaN(cardNum) || cardNum <= 0) {
      Alert.alert('Input Error', 'Please enter a valid Card Number.');
      return;
    }

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      Alert.alert('Input Error', 'Please enter a Name.');
      return;
    }

    const existingCard = rows.find((r) => r.card_number === cardNum);

    if (existingCard && existingCard.name && existingCard.name.trim().length > 0) {
      setConfirmDialog({
        visible: true,
        type: 'name',
        cardNumber: cardNum,
        previousValue: existingCard.name,
        newValue: trimmedName,
        onConfirm: () => {
          commitCardUpdate(cardNum, null, trimmedName);
          setConfirmDialog((d) => ({ ...d, visible: false }));
          showToast(`Card ${cardNum} name updated`);
        },
        onCancel: () => {
          setConfirmDialog((d) => ({ ...d, visible: false }));
        },
      });
    } else {
      commitCardUpdate(cardNum, null, trimmedName);
      showToast(`Card ${cardNum} name assigned`);
    }
  }, [cardInput, nameInput, rows, commitCardUpdate, showToast]);

  // Delete Card Button Logic
  const handleDeleteCard = useCallback(() => {
    const cardNum = parseInt(cardInput.trim(), 10);
    if (isNaN(cardNum) || cardNum <= 0) {
      Alert.alert('Input Error', 'Please enter a valid Card Number to delete.');
      return;
    }

    const existingCard = rows.find((r) => r.card_number === cardNum);
    if (!existingCard) {
      Alert.alert('Not Found', `Card ${cardNum} does not exist in the table.`);
      return;
    }

    const timeLine = existingCard.time !== null ? `Time: ${formatTime(existingCard.time)}s` : 'Time: —';
    const nameLine = existingCard.name ? `Name: ${existingCard.name}` : 'Name: —';
    const rankLine = existingCard.rank !== null ? `Rank: ${existingCard.rank}` : 'Rank: —';

    Alert.alert(
      `Delete Card ${cardNum}?`,
      `Current data:\n${timeLine}\n${nameLine}\n${rankLine}\n\nThis will reset the card to default values.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          style: 'destructive',
          onPress: () => {
            setRows((prevRows) => {
              const updated = prevRows.map((r) =>
                r.card_number === cardNum
                  ? { card_number: cardNum, name: null, time: null, rank: null }
                  : r
              );
              return computeSortedRows(updated);
            });
            setRecentEntries((prev) => prev.filter((p) => p.card_number !== cardNum));
            setCardInput('');
            setTimeInput('');
            setNameInput('');
            showToast(`Card ${cardNum} reset to default`);
          },
        },
      ]
    );
  }, [cardInput, rows, showToast]);

  const handleClearInputs = useCallback(() => {
    setCardInput('');
    setTimeInput('');
    setNameInput('');
  }, []);

  // Upload Tab Handlers
  const handleUrlChange = useCallback((newUrl: string) => {
    setUploadUrl(newUrl);
    saveUploadUrl(newUrl);
  }, []);

  const handleToggleUploadColumn = useCallback((col: UploadColumnKey) => {
    setSelectedUploadColumns((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col];
      saveUploadColumns(next);
      return next;
    });
  }, []);

  const handleSelectAllUploadColumns = useCallback(() => {
    setSelectedUploadColumns(DEFAULT_UPLOAD_COLUMNS);
    saveUploadColumns(DEFAULT_UPLOAD_COLUMNS);
  }, []);

  const handleClearUploadColumns = useCallback(() => {
    setSelectedUploadColumns([]);
    saveUploadColumns([]);
  }, []);

  const timedCount = rows.filter((r) => r.time !== null && r.time > 0).length;

  return (
    <View style={[styles.rootContainer, { paddingTop: topPadding, paddingBottom: insets.bottom }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <Header
        onOpenCsv={handleOpenCsv}
        onSaveCsv={handleSaveCsv}
        onRefresh={handleRefresh}
        onClear={() => setShowClearModal(true)}
        isLoading={isLoading}
        currentFileName={currentFileName}
      />

      {/* Persistence warning banner */}
      {dataPermission === false && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>
            ⚠ Data persistence disabled — data will be lost on app close
          </Text>
        </View>
      )}

      {/* Subtle Toast */}
      {toastMessage && (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 3-Tab Navigation (Work, Table, Upload) */}
      <TabNavigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        timedCount={timedCount}
        totalCount={rows.length}
      />

      {/* Active Tab Screen */}
      <View style={styles.screenContainer}>
        {currentTab === 'work' && (
          <WorkTab
            cardInput={cardInput}
            setCardInput={setCardInput}
            nameInput={nameInput}
            setNameInput={setNameInput}
            timeInput={timeInput}
            setTimeInput={setTimeInput}
            onAddTime={handleAddTime}
            onAddName={handleAddName}
            onDeleteCard={handleDeleteCard}
            onClearInputs={handleClearInputs}
            rows={rows}
            recentEntries={recentEntries}
          />
        )}
        {currentTab === 'table' && (
          <TableTab
            rows={rows}
            prices={prices}
            onOpenPriceModal={() => setIsPriceModalOpen(true)}
            searchColumn={searchColumn}
            setSearchColumn={setSearchColumn}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
        {currentTab === 'upload' && (
          <UploadTab
            rows={rows}
            prices={prices}
            url={uploadUrl}
            onUrlChange={handleUrlChange}
            selectedColumns={selectedUploadColumns}
            onToggleColumn={handleToggleUploadColumn}
            onSelectAllColumns={handleSelectAllUploadColumns}
            onClearColumns={handleClearUploadColumns}
            showToast={showToast}
          />
        )}
      </View>

      {/* Confirmation Modal */}
      <ConfirmModal dialog={confirmDialog} />

      {/* Edit Prices Modal */}
      <EditPriceModal
        visible={isPriceModalOpen}
        prices={prices}
        onSavePrices={(newPrices) => {
          setPrices(newPrices);
          showToast('Prizes updated');
        }}
        onClose={() => setIsPriceModalOpen(false)}
      />

      {/* Clear Warning Modal */}
      <ClearWarningModal
        visible={showClearModal}
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Data Permission Modal (first launch) */}
      <DataPermissionModal
        visible={showPermissionModal}
        onAllow={handleAllowPermission}
        onDecline={handleDeclinePermission}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  warningBanner: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  warningBannerText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  toastBox: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: '#0F172A',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toastText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 12,
  },
});
