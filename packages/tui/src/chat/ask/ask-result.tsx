import { Box, Text } from 'ink';
import { useTheme } from '../../runtime/theme.js';
import { Frame, FrameDivider } from '../../primitives/frame.js';
import { NoteLine } from '../../primitives/option-row.js';
import { Prose } from '../../primitives/prose.js';
import { plural } from '../../utils/plural.js';
import type { Question, QuestionAnswer } from './question.js';

export interface AskResultProps {
  questions: Question[];
  answers: QuestionAnswer[];
  cancelled?: boolean;
}

export function AskResult({ questions, answers, cancelled = false }: AskResultProps) {
  const theme = useTheme();

  const count = plural(questions.length, 'question');

  return (
    <Frame
      lead={1}
      tone={cancelled ? 'neutral' : 'success'}
      title={
        <Text>
          <Text color={cancelled ? theme.muted : theme.success}>{cancelled ? '[-]' : '[ok]'}</Text> Ask {count}
        </Text>
      }
    >
      {questions.flatMap((question, index) => {
        const answer = answers[index];

        const picked = [
          ...(answer?.options ?? []).map((option) => ({ number: option + 1, option: question.options[option] })),
          ...(answer?.text ? [{ number: question.options.length + 1, option: undefined }] : []),
        ];

        const indent = `  ${question.options.length + 1}. `.length;

        return [
          index > 0 && <FrameDivider key={`divider-${question.id}`} />,
          <Box key={question.id} flexDirection="column">
            <Prose bold>{question.prompt}</Prose>
            {picked.length > 0 ? (
              picked.map(({ number, option }) => (
                <Box key={number}>
                  <Box flexShrink={0} width={indent}>
                    <Text color={theme.selection}>{`  ${number}.`}</Text>
                  </Box>
                  <Prose>
                    {option ? (
                      <Text color={theme.selection}>{option.label}</Text>
                    ) : (
                      <Text>
                        <Text color={theme.muted}>Other: </Text>
                        <Text color={theme.selection}>{answer?.text}</Text>
                      </Text>
                    )}
                    {option?.description && <Text color={theme.muted}> — {option.description}</Text>}
                  </Prose>
                </Box>
              ))
            ) : (
              <Text color={theme.muted}>{cancelled ? '  cancelled' : '  no answer'}</Text>
            )}
            {answer?.note && <NoteLine note={answer.note} indent={indent} />}
          </Box>,
        ];
      })}
    </Frame>
  );
}
