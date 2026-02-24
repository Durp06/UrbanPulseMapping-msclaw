import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../constants/colors';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-white px-8">
          <Text className="text-5xl mb-4">⚠️</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
            Something went wrong
          </Text>
          <Text className="text-sm text-gray-500 mb-6 text-center">
            An unexpected error occurred. Please try again.
          </Text>
          {__DEV__ && this.state.error && (
            <View className="bg-red-50 rounded-xl p-3 mb-4 w-full">
              <Text className="text-xs text-red-700 font-mono">
                {this.state.error.message}
              </Text>
            </View>
          )}
          <Pressable
            className="py-3.5 px-8 rounded-xl"
            style={{ backgroundColor: colors.primary }}
            onPress={this.handleRetry}
          >
            <Text className="text-white font-semibold text-base">
              Tap to Retry
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
