import type { SurveyDefinition } from '@kajay/core';

export const QUICKSTART_DEFINITION: SurveyDefinition = {
  title: 'Product feedback',
  pages: [
    {
      name: 'feedback',
      elements: [
        {
          type: 'radiogroup',
          name: 'rating',
          title: 'How was your experience?',
          isRequired: true,
          choices: ['Great', 'Fine', 'Poor'],
        },
        {
          type: 'comment',
          name: 'details',
          title: 'What could we improve?',
          visibleIf: "{rating} == 'Poor'",
        },
      ],
    },
  ],
};

export const QUICKSTART_DEFINITION_SOURCE = `const definition: SurveyDefinition = {
  title: 'Product feedback',
  pages: [{
    name: 'feedback',
    elements: [
      {
        type: 'radiogroup',
        name: 'rating',
        title: 'How was your experience?',
        isRequired: true,
        choices: ['Great', 'Fine', 'Poor'],
      },
      {
        type: 'comment',
        name: 'details',
        title: 'What could we improve?',
        visibleIf: "{rating} == 'Poor'",
      },
    ],
  }],
}`;

export const QUICKSTART_COMPONENT_SOURCE = `import { parseSurvey, type SurveyDefinition } from '@kajay/core'
import { Survey } from '@kajay/react'
import { useEffect, useState } from 'react'

function FeedbackSurvey({
  onSubmit,
}: {
  onSubmit: (data: Readonly<Record<string, unknown>>) => void
}) {
  const [model] = useState(() => parseSurvey(definition).survey)

  useEffect(
    () => model.onComplete.add(({ data }) => { onSubmit(data) }),
    [model, onSubmit],
  )

  return <Survey model={model} />
}`;

export const CONDITIONAL_DEFINITION_SOURCE = `{
  "pages": [{
    "name": "shipping",
    "elements": [
      {
        "type": "boolean",
        "name": "needsShipping",
        "title": "Ship a physical copy?"
      },
      {
        "type": "text",
        "name": "address",
        "title": "Shipping address",
        "visibleIf": "{needsShipping} == true",
        "requiredIf": "{needsShipping} == true"
      },
      {
        "type": "text",
        "name": "trackingNote",
        "title": "Tracking note",
        "enableIf": "{address} notempty"
      }
    ]
  }]
}`;

export const VALIDATION_DEFINITION_SOURCE = `{
  "checkErrorsMode": "onNextPage",
  "questionErrorLocation": "top",
  "pages": [{
    "name": "contact",
    "elements": [
      {
        "type": "text",
        "name": "email",
        "title": "Work email",
        "isRequired": true,
        "requiredErrorText": "Enter your work email.",
        "validators": [
          { "type": "emailvalidator", "text": "Enter a valid email address." }
        ]
      },
      {
        "type": "text",
        "name": "seats",
        "title": "Number of seats",
        "inputType": "number",
        "validators": [
          { "type": "numericvalidator", "minValue": 1, "maxValue": 500 }
        ]
      }
    ]
  }]
}`;

export const HOST_VALIDATION_SOURCE = `import type {
  ServerValidationError,
  ServerValidator,
  Survey,
} from '@kajay/core'

function isServerError(value: unknown): value is ServerValidationError {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).questionName === 'string'
    && typeof (value as Record<string, unknown>).text === 'string'
}

export function configureValidation(survey: Survey, reservedNames: ReadonlySet<string>) {
  const stop = survey.onValidateQuestion.add(({ question, value, addError }) => {
    if (question.name === 'username' && reservedNames.has(String(value))) {
      addError('That username is reserved.')
    }
  })

  const validateOnServer: ServerValidator = async (request) => {
    const response = await fetch('/api/survey/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error('Validation service unavailable')

    const payload: unknown = await response.json()
    if (!Array.isArray(payload) || !payload.every(isServerError)) {
      throw new Error('Validation service returned an invalid response')
    }
    return payload
  }

  survey.validation.setServerValidator(validateOnServer)
  return () => {
    stop()
    survey.validation.setServerValidator(undefined)
  }
}`;
