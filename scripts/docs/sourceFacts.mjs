import ts from 'typescript';

function nodeName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
}

function objectProperty(object, name) {
  return object.properties.find(
    (property) => ts.isPropertyAssignment(property) && nodeName(property.name) === name,
  );
}

function stringValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
}

function numberValue(node) {
  return ts.isNumericLiteral(node) ? Number(node.text) : undefined;
}

function stringArray(node) {
  if (!ts.isArrayLiteralExpression(node)) {
    return [];
  }
  return node.elements.map(stringValue).filter((value) => value !== undefined);
}

function constObject(sourceFile, name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && nodeName(node.name) === name) {
      const initializer = node.initializer;
      if (initializer !== undefined && ts.isObjectLiteralExpression(initializer)) {
        result = initializer;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}

function operatorRecord(property, kind) {
  if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
    return;
  }
  const name = nodeName(property.name);
  const spellings = objectProperty(property.initializer, 'spellings');
  const precedenceName = kind === 'unary' ? 'printPrecedence' : 'printPrecedence';
  const precedence = objectProperty(property.initializer, precedenceName);
  const associativity = objectProperty(property.initializer, 'associativity');
  if (name === undefined || spellings === undefined || precedence === undefined) {
    return;
  }
  const precedenceValue = numberValue(precedence.initializer);
  if (precedenceValue === undefined) {
    return;
  }
  return {
    name,
    kind,
    spellings: stringArray(spellings.initializer),
    precedence: precedenceValue,
    associativity: associativity === undefined ? null : stringValue(associativity.initializer) ?? null,
  };
}

/** Extracts syntax facts from the same exhaustive records used by parser and printer. */
export function expressionOperators(source) {
  const sourceFile = ts.createSourceFile('operators.ts', source, ts.ScriptTarget.Latest, true);
  const tables = [
    ['BINARY_OPERATORS', 'binary'],
    ['UNARY_OPERATORS', 'unary'],
    ['POSTFIX_OPERATORS', 'postfix'],
  ];
  return tables.flatMap(([name, kind]) => {
    const object = constObject(sourceFile, name);
    return object === undefined
      ? []
      : object.properties.map((property) => operatorRecord(property, kind)).filter(Boolean);
  });
}

function registeredNames(functionNode, category) {
  const records = [];
  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'override'
    ) {
      const name = stringValue(node.arguments[0]);
      if (name !== undefined) {
        records.push({ name, category });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(functionNode);
  return records;
}

/** Built-ins are authoritative calls grouped by their registration function. */
export function expressionFunctions(source) {
  const sourceFile = ts.createSourceFile('builtInFunctions.ts', source, ts.ScriptTarget.Latest, true);
  const categories = new Map([
    ['registerLogicFunctions', 'logic'],
    ['registerMathFunctions', 'math'],
    ['registerDateFunctions', 'date'],
  ]);
  const records = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      const category = categories.get(node.name.text);
      if (category !== undefined) {
        records.push(...registeredNames(node, category));
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return records;
}

/** Reads exactly what each package root re-exports, including type-only symbols. */
export function packageExports(source) {
  const sourceFile = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  const records = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      if (!ts.isNamedExports(statement.exportClause)) {
        continue;
      }
      for (const element of statement.exportClause.elements) {
        records.push({
          name: element.name.text,
          exportKind: statement.isTypeOnly || element.isTypeOnly ? 'type' : 'value',
        });
      }
      continue;
    }
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) {
      continue;
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      records.push({ name: statement.name.text, exportKind: 'type' });
    } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name !== undefined) records.push({ name: statement.name.text, exportKind: 'value' });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = nodeName(declaration.name);
        if (name !== undefined) records.push({ name, exportKind: 'value' });
      }
    }
  }
  return records;
}

function ledgerClassification(label) {
  const normalized = label.toLocaleLowerCase('en-US');
  if (normalized.includes('maintained')) {
    return 'adapter';
  }
  if (normalized.includes('extension') || normalized.includes('host design-system')) {
    return 'extension';
  }
  return 'consumer';
}

/** Parses the checked human ledger; its value lists are independently enforced by CI. */
export function runtimeClassifications(markdown) {
  const result = new Map();
  let packageName;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## `([^`]+)`/u);
    if (heading !== null) {
      packageName = heading[1];
      continue;
    }
    if (packageName === undefined || !line.startsWith('|')) {
      continue;
    }
    const columns = line.split('|');
    const label = columns[1]?.trim() ?? '';
    const values = columns[2]?.matchAll(/`([^`]+)`/gu) ?? [];
    for (const match of values) {
      result.set(`${packageName}:${match[1]}`, ledgerClassification(label));
    }
  }
  return result;
}
