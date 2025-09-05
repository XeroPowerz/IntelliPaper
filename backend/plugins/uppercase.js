export default function(register) {
  register({
    name: 'uppercase',
    actions: {
      shout: {
        description: 'Convert text to uppercase',
        handler: async ({ text = '' }) => ({ result: text.toUpperCase() }),
      },
    },
  });
}
