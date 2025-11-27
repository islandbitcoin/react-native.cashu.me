/**
 * Amount Input
 *
 * Specialized input for entering sats amounts with USD conversion.
 *
 * Features:
 * - Large, easy-to-read amount display
 * - Toggle between sats and USD
 * - Real-time conversion
 * - Quick amount buttons (1k, 5k, 10k, etc.)
 * - Max button to use full balance
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

export interface AmountInputProps {
  value: number; // Always in sats
  onChange: (sats: number) => void;
  maxAmount?: number;
  btcPriceUSD?: number; // Bitcoin price in USD
  label?: string;
  error?: string;
}

export function AmountInput({
  value,
  onChange,
  maxAmount,
  btcPriceUSD = 50000, // Default BTC price
  label = 'Amount',
  error,
}: AmountInputProps) {
  const [displayMode, setDisplayMode] = useState<'sats' | 'usd'>('sats');
  const [inputValue, setInputValue] = useState('');

  // Convert sats to USD
  const satsToUSD = (sats: number): number => {
    return (sats / 100000000) * btcPriceUSD;
  };

  // Convert USD to sats
  const usdToSats = (usd: number): number => {
    return Math.floor((usd / btcPriceUSD) * 100000000);
  };

  // Update input value when value prop changes
  useEffect(() => {
    if (value === 0) {
      setInputValue('');
    } else if (displayMode === 'sats') {
      setInputValue(value.toString());
    } else {
      setInputValue(satsToUSD(value).toFixed(2));
    }
  }, [value, displayMode]);

  // Handle input change
  const handleInputChange = (text: string) => {
    // Remove non-numeric characters except decimal point
    const cleanedText = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = cleanedText.split('.');
    const validText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanedText;

    setInputValue(validText);

    // Convert to sats and update
    if (validText === '' || validText === '.') {
      onChange(0);
    } else {
      const numericValue = parseFloat(validText);
      if (!isNaN(numericValue)) {
        const sats = displayMode === 'sats' ? Math.floor(numericValue) : usdToSats(numericValue);
        onChange(sats);
      }
    }
  };

  // Toggle display mode
  const toggleMode = () => {
    setDisplayMode(prev => (prev === 'sats' ? 'usd' : 'sats'));
  };

  // Quick amount buttons (in sats)
  const quickAmounts = [1000, 5000, 10000, 50000, 100000];

  // Set to max amount
  const setMax = () => {
    if (maxAmount !== undefined) {
      onChange(maxAmount);
    }
  };

  // Conversion display
  const conversionText =
    value > 0
      ? displayMode === 'sats'
        ? `≈ $${satsToUSD(value).toFixed(2)} USD`
        : `≈ ${usdToSats(parseFloat(inputValue || '0')).toLocaleString()} sats`
      : '';

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Main Amount Input */}
      <View style={[styles.inputContainer, error && styles.inputContainerError]}>
        <View style={styles.inputRow}>
          <Text style={styles.currencySymbol}>{displayMode === 'usd' ? '$' : ''}</Text>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={handleInputChange}
            placeholder="0"
            placeholderTextColor={theme.colors.text.tertiary}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <TouchableOpacity onPress={toggleMode} style={styles.currencyToggle}>
            <Text style={styles.currencyText}>{displayMode === 'sats' ? 'sats' : 'USD'}</Text>
          </TouchableOpacity>
        </View>

        {/* Conversion Text */}
        {conversionText && <Text style={styles.conversionText}>{conversionText}</Text>}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Quick Amount Buttons */}
      <View style={styles.quickButtons}>
        {quickAmounts.map(amount => (
          <TouchableOpacity
            key={amount}
            style={styles.quickButton}
            onPress={() => onChange(amount)}
          >
            <Text style={styles.quickButtonText}>
              {amount >= 1000 ? `${amount / 1000}k` : amount}
            </Text>
          </TouchableOpacity>
        ))}
        {maxAmount !== undefined && maxAmount > 0 && (
          <TouchableOpacity style={[styles.quickButton, styles.maxButton]} onPress={setMax}>
            <Text style={[styles.quickButtonText, styles.maxButtonText]}>Max</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  label: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },

  inputContainer: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.border.primary,
    padding: theme.spacing.lg,
  },

  inputContainerError: {
    borderColor: theme.colors.status.error,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  currencySymbol: {
    ...theme.typography.amount,
    color: theme.colors.text.primary,
    marginRight: theme.spacing.xs,
  },

  input: {
    flex: 1,
    ...theme.typography.amount,
    color: theme.colors.text.primary,
    padding: 0,
  },

  currencyToggle: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
  },

  currencyText: {
    ...theme.typography.label,
    color: theme.colors.primary[500],
  },

  conversionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },

  errorText: {
    ...theme.typography.caption,
    color: theme.colors.status.error,
    marginTop: theme.spacing.xs,
  },

  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },

  quickButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.border.primary,
  },

  quickButtonText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },

  maxButton: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },

  maxButtonText: {
    color: theme.colors.white,
  },
});

export default AmountInput;
