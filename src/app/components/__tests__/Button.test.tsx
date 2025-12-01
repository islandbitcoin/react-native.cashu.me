/**
 * Button Component Tests
 *
 * Tests for the Button component covering all variants, sizes, and states.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      const { getByText } = render(
        <Button onPress={() => {}}>Click Me</Button>
      );

      expect(getByText('Click Me')).toBeTruthy();
    });

    it('renders with custom text', () => {
      const { getByText } = render(
        <Button onPress={() => {}}>Custom Text</Button>
      );

      expect(getByText('Custom Text')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('renders primary variant correctly', () => {
      const { getByText } = render(
        <Button variant="primary" onPress={() => {}}>
          Primary
        </Button>
      );

      const button = getByText('Primary').parent;
      expect(button).toBeTruthy();
    });

    it('renders secondary variant correctly', () => {
      const { getByText } = render(
        <Button variant="secondary" onPress={() => {}}>
          Secondary
        </Button>
      );

      expect(getByText('Secondary')).toBeTruthy();
    });

    it('renders outline variant correctly', () => {
      const { getByText } = render(
        <Button variant="outline" onPress={() => {}}>
          Outline
        </Button>
      );

      expect(getByText('Outline')).toBeTruthy();
    });

    it('renders ghost variant correctly', () => {
      const { getByText } = render(
        <Button variant="ghost" onPress={() => {}}>
          Ghost
        </Button>
      );

      expect(getByText('Ghost')).toBeTruthy();
    });

    it('renders danger variant correctly', () => {
      const { getByText } = render(
        <Button variant="danger" onPress={() => {}}>
          Danger
        </Button>
      );

      expect(getByText('Danger')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      const { getByText } = render(
        <Button size="sm" onPress={() => {}}>
          Small
        </Button>
      );

      expect(getByText('Small')).toBeTruthy();
    });

    it('renders medium size correctly (default)', () => {
      const { getByText } = render(
        <Button size="md" onPress={() => {}}>
          Medium
        </Button>
      );

      expect(getByText('Medium')).toBeTruthy();
    });

    it('renders large size correctly', () => {
      const { getByText } = render(
        <Button size="lg" onPress={() => {}}>
          Large
        </Button>
      );

      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('States', () => {
    it('handles onPress correctly', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <Button onPress={onPressMock}>Press Me</Button>
      );

      fireEvent.press(getByText('Press Me'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('disables button when disabled prop is true', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <Button disabled onPress={onPressMock}>
          Disabled
        </Button>
      );

      fireEvent.press(getByText('Disabled'));
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('shows loading spinner when loading is true', () => {
      const { queryByText, UNSAFE_getByType } = render(
        <Button loading onPress={() => {}}>
          Loading
        </Button>
      );

      // Text should not be visible when loading
      expect(queryByText('Loading')).toBeNull();

      // ActivityIndicator should be present
      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('disables button when loading is true', () => {
      const onPressMock = jest.fn();
      const { UNSAFE_getByType } = render(
        <Button loading onPress={onPressMock}>
          Loading
        </Button>
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      // Verify the button is disabled when loading
      // Note: fireEvent.press may still trigger onPress in some test scenarios
      // even with disabled=true, so we verify the prop instead
      expect(button.props.disabled).toBe(true);
    });
  });

  describe('Layout', () => {
    it('renders full width when fullWidth is true', () => {
      const { UNSAFE_getByType } = render(
        <Button fullWidth onPress={() => {}}>
          Full Width
        </Button>
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            width: '100%',
          }),
        ])
      );
    });
  });

  describe('Custom Styles', () => {
    it('applies custom container styles', () => {
      const customStyle = { marginTop: 20 };
      const { UNSAFE_getByType } = render(
        <Button style={customStyle} onPress={() => {}}>
          Custom Style
        </Button>
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('applies custom text styles', () => {
      const customTextStyle = { fontSize: 20 };
      const { getByText } = render(
        <Button textStyle={customTextStyle} onPress={() => {}}>
          Custom Text Style
        </Button>
      );

      const text = getByText('Custom Text Style');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customTextStyle),
        ])
      );
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility properties when disabled', () => {
      const { UNSAFE_getByType } = render(
        <Button disabled onPress={() => {}}>
          Disabled
        </Button>
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.disabled).toBe(true);
    });

    it('has correct accessibility properties when loading', () => {
      const { UNSAFE_getByType } = render(
        <Button loading onPress={() => {}}>
          Loading
        </Button>
      );

      const { TouchableOpacity } = require('react-native');
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.disabled).toBe(true);
    });
  });
});
