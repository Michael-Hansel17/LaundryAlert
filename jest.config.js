// UI tests exercise the in-app demo repositories; the backend flow is covered by tests/*.test.ts.
process.env.EXPO_PUBLIC_API_MODE = 'demo';

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
  modulePathIgnorePatterns: ['<rootDir>/tmp/', '<rootDir>/dist/'],
  collectCoverageFrom: [
    'src/features/laundry/presentation/SubmitLaundryView.tsx',
    'src/features/laundry/state/LaundrySubmissionController.ts',
    'src/features/admin/presentation/AdminStatusView.tsx',
    'src/features/admin/state/AdminStatusController.ts',
  ],
  coverageDirectory: 'coverage',
};
