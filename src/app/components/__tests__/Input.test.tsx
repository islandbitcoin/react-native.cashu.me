/**
 * Input Component Tests
 *
 * Tests for the Input component covering all features and states.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../Input';
import { Text } from 'react-native';

describe('Input', () => {
  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      const { UNSAFE_getByType } = render(
        <Input />
      );

      const { TextInput } = require('react-native');
      expect(UNSAFE_getByType(TextInput)).toBeTruthy();
    });

    it('renders with label', () => {
      const { getByText } = render(
        <Input label="Email" />
      );

      expect(getByText('Email')).toBeTruthy();
    });

    it('renders with helper text', () => {
      const { getByText } = render(
        <Input helperText="Enter your email address" />
      );

      expect(getByText('Enter your email address')).toBeTruthy();
    });

    it('renders with error message', () => {
      const { getByText } = render(
        <Input error="Email is required" />
      );

      expect(getByText('Email is required')).toBeTruthy();
    });

    it('prioritizes error over helper text', () => {
      const { getByText, queryByText } = render(
        <Input
          helperText="Helper text"
          error="Error message"
        />
      );

      expect(getByText('Error message')).toBeTruthy();
      expect(queryByText('Helper text')).toBeNull();
    });
  });

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      const { UNSAFE_getByType } = render(
        <Input size="sm" />
      );

      const { TextInput } = require('react-native');
      expect(UNSAFE_getByType(TextInput)).toBeTruthy();
    });

    it('renders medium size correctly (default)', () => {
      const { UNSAFE_getByType } = render(
        <Input size="md" />
      );

      const { TextInput } = require('react-native');
      expect(UNSAFE_getByType(TextInput)).toBeTruthy();
    });

    it('renders large size correctly', () => {
      const { UNSAFE_getByType } = render(
        <Input size="lg" />
      );

      const { TextInput } = require('react-native');
      expect(UNSAFE_getByType(TextInput)).toBeTruthy();
    });
  });

  describe('Icons', () => {
    it('renders with left icon', () => {
      const LeftIcon = () => <Text>Left</Text>;
      const { getByText } = render(
        <Input leftIcon={<LeftIcon />} />
      );

      expect(getByText('Left')).toBeTruthy();
    });

    it('renders with right icon', () => {
      const RightIcon = () => <Text>Right</Text>;
      const { getByText } = render(
        <Input rightIcon={<RightIcon />} />
      );

      expect(getByText('Right')).toBeTruthy();
    });

    it('renders with both left and right icons', () => {
      const LeftIcon = () => <Text>Left</Text>;
      const RightIcon = () => <Text>Right</Text>;
      const { getByText } = render(
        <Input
          leftIcon={<LeftIcon />}
          rightIcon={<RightIcon />}
        />
      );

      expect(getByText('Left')).toBeTruthy();
      expect(getByText('Right')).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('handles text input correctly', () => {
      const onChangeTextMock = jest.fn();
      const { UNSAFE_getByType } = render(
        <Input onChangeText={onChangeTextMock} />
      );

      const { TextInput } = require('react-native');
      const input = UNSAFE_getByType(TextInput);

      fireEvent.changeText(input, 'test@example.com');
      expect(onChangeTextMock).toHaveBeenCalledWith('test@example.com');
    });

    it('displays value correctly', () => {
      const { UNSAFE_getByType } = render(
        <Input value="Initial value" />
      );

      const { TextInput } = require('react-native');
      const input = UNSAFE_getByType(TextInput);

      expect(input.props.value).toBe('Initial value');
    });

    it('shows placeholder text', () => {
      const { UNSAFE_getByType } = render(
        <Input placeholder="Enter email" />
      );

      const { TextInput } = require('react-native');
      const input = UNSAFE_getByType(TextInput);

      expect(input.props.placeholder).toBe('Enter email');
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container styles', () => {
      const customStyle = { marginTop: 20 };
      const { UNSAFE_getByType } = render(
        <Input containerStyle={customStyle} />
      );

      const { View } = require('react-native');
      const container = UNSAFE_getByType(View);

      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });
  });

  describe('TextInput Props', () => {
    it('forwards all TextInput props correctly', () => {
      const { UNSAFE_getByType } = render(
        <Input
          secureTextEntry
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      );

      const { TextInput } = require('react-native');
      const input = UNSAFE_getByType(TextInput);

      expect(input.props.secureTextEntry).toBe(true);
      expect(input.props.keyboardType).toBe('email-address');
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.autoComplete).toBe('email');
    });
  });
});
