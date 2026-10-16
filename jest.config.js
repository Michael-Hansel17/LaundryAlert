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
