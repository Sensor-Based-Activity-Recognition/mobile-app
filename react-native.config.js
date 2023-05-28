module.exports = {
    project: {
      ios: {
        sourceDir: './ios', // point this to the directory of your actual iOS project
      },
    },
    dependencies: {
      'react-native-vector-icons': {
        platforms: {
          ios: null,
        },
      },
    }
  };