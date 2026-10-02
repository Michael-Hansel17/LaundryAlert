module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/features/laundry/presentation/SubmitLaundryView.tsx',
    'src/features/laundry/state/LaundrySubmissionController.ts',
  ],
  coverageDirectory: 'coverage',
};
