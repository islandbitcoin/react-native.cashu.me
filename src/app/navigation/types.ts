/**
 * Navigation Types
 *
 * Type-safe navigation for React Navigation.
 * Defines all routes and their parameters.
 *
 * Usage:
 * import { useNavigation } from '@react-navigation/native';
 * import { RootStackNavigationProp } from '@/app/navigation/types';
 *
 * const navigation = useNavigation<RootStackNavigationProp>();
 * navigation.navigate('Send', { amount: 1000 });
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

/**
 * Home Stack (Balance, Transaction Details)
 */
export type HomeStackParamList = {
  HomeMain: undefined;
  TransactionDetails: {
    transactionId: string;
  };
  ProofDetails: {
    proofId: string;
  };
};

/**
 * Send Stack (Send flow)
 */
export type SendStackParamList = {
  SendMain: undefined;
  SendAmount: {
    mintUrl?: string;
  };
  SendConfirm: {
    amount: number;
    mintUrl: string;
    transportType?: 'nfc' | 'bluetooth' | 'qr';
  };
  SendTransport: {
    amount: number;
    mintUrl: string;
    token: string;
  };
  SendSuccess: {
    amount: number;
    transactionId: string;
  };
};

/**
 * Receive Stack (Receive flow)
 */
export type ReceiveStackParamList = {
  ReceiveMain: undefined;
  ReceiveAmount: {
    mintUrl?: string;
  };
  ReceiveQR: {
    amount?: number;
    mintUrl?: string;
    paymentRequest: string;
  };
  ReceiveSuccess: {
    amount: number;
    transactionId: string;
  };
};

/**
 * Scan Stack (QR/NFC scanning)
 */
export type ScanStackParamList = {
  ScanMain: undefined;
  ScanResult: {
    data: string;
    type: 'token' | 'payment_request' | 'mint_url';
  };
};

/**
 * History Stack (Transaction history)
 */
export type HistoryStackParamList = {
  HistoryMain: undefined;
  HistoryFilter: undefined;
  TransactionDetails: {
    transactionId: string;
  };
};

/**
 * Settings Stack (All settings screens)
 */
export type SettingsStackParamList = {
  SettingsMain: undefined;
  OCRConfiguration: undefined;
  MintManagement: undefined;
  MintAdd: undefined;
  MintDetails: {
    mintId: string;
  };
  TransportSelection: undefined;
  BackupRecovery: undefined;
  BackupExport: undefined;
  BackupImport: undefined;
  Security: undefined;
  About: undefined;
};

/**
 * Bottom Tab Navigator
 */
export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Scan: NavigatorScreenParams<ScanStackParamList>;
  Send: NavigatorScreenParams<SendStackParamList>;
  History: NavigatorScreenParams<HistoryStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

/**
 * Root Stack (Modal screens, onboarding)
 */
export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  Onboarding: undefined;
  CreateWallet: undefined;
  ImportWallet: undefined;
  ReceiveModal: NavigatorScreenParams<ReceiveStackParamList>;
  OCRAlert: {
    status: string;
    balance: number;
  };
};

/**
 * Navigation prop types
 */
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;
export type HomeStackNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
export type SendStackNavigationProp = NativeStackNavigationProp<SendStackParamList>;
export type ReceiveStackNavigationProp = NativeStackNavigationProp<ReceiveStackParamList>;
export type ScanStackNavigationProp = NativeStackNavigationProp<ScanStackParamList>;
export type HistoryStackNavigationProp = NativeStackNavigationProp<HistoryStackParamList>;
export type SettingsStackNavigationProp = NativeStackNavigationProp<SettingsStackParamList>;

/**
 * Route prop types (for useRoute)
 */
import { RouteProp } from '@react-navigation/native';

export type SendAmountRouteProp = RouteProp<SendStackParamList, 'SendAmount'>;
export type SendConfirmRouteProp = RouteProp<SendStackParamList, 'SendConfirm'>;
export type SendTransportRouteProp = RouteProp<SendStackParamList, 'SendTransport'>;
export type SendSuccessRouteProp = RouteProp<SendStackParamList, 'SendSuccess'>;

export type ReceiveAmountRouteProp = RouteProp<ReceiveStackParamList, 'ReceiveAmount'>;
export type ReceiveQRRouteProp = RouteProp<ReceiveStackParamList, 'ReceiveQR'>;
export type ReceiveSuccessRouteProp = RouteProp<ReceiveStackParamList, 'ReceiveSuccess'>;

export type TransactionDetailsRouteProp = RouteProp<HistoryStackParamList, 'TransactionDetails'>;
export type MintDetailsRouteProp = RouteProp<SettingsStackParamList, 'MintDetails'>;

export type ScanResultRouteProp = RouteProp<ScanStackParamList, 'ScanResult'>;
export type OCRAlertRouteProp = RouteProp<RootStackParamList, 'OCRAlert'>;
