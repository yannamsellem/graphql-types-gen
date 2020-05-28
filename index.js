const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { parse, visit } = require("graphql");

const typedefs = readFileSync(join(__dirname, "schema.graphql"), "utf-8");

const defaultScalars = {
  ID: "string",
  String: "string",
  Boolean: "boolean",
  Int: "number",
  Float: "number",
};

const ast = parse(typedefs);

const rows = visit(ast, {
  Document: {
    leave(node) {
      return node.definitions;
    },
  },
  Name: {
    leave(node) {
      return node.value;
    },
  },
  NamedType: {
    leave(node) {
      return defaultScalars[node.name] || node.name;
    },
  },
  NonNullType: {
    leave(node, _, parent) {
      return parent === undefined ? node : node.type;
    },
  },
  ScalarTypeDefinition: {
    leave(node) {
      if (node.name === "Date") return null;
      return `type ${node.name} = any`;
    },
  },
  UnionTypeDefinition: {
    leave(node) {
      return `type ${node.name} = ${(node.types || []).join(" | ")}`;
    },
  },
  EnumTypeDefinition: {
    leave(node) {
      return `type ${node.name} = ${(node.values || [])
        .map((value) => `"${value.name}"`)
        .join(" | ")}`;
    },
  },
  FieldDefinition: {
    enter(node) {
      return { ...node, nonNullable: node.type.kind === "NonNullType" };
    },
    leave(node) {
      return `${node.name}${node.nonNullable ? "" : "?"}: ${node.type}`;
    },
  },
  ListType: {
    leave(node) {
      return `${node.type}[]`;
    },
  },
  ObjectTypeDefinition: {
    leave(node) {
      if (
        node.name === "Query" ||
        node.name === "Mutation" ||
        node.name === "Subscription"
      ) {
        return null;
      }

      const extend =
        node.interfaces && node.interfaces.length > 0
          ? `extends ${node.interfaces.join(", ")} `
          : "";

      return `interface ${node.name} ${extend}{\n${node.fields
        .map((field) => "\t" + field)
        .join("\n")}\n}`;
    },
  },
  InterfaceTypeDefinition: {
    leave(node) {
      return `interface ${node.name} {\n${node.fields
        .map((field) => "\t" + field)
        .join("\n")}\n}`;
    },
  },
  InputObjectTypeDefinition: {
    leave(node) {
      return `interface ${node.name} {\n${node.fields
        .map((field) => "\t" + field)
        .join("\n")}\n}`;
    },
  },
  InputValueDefinition: {
    enter(node) {
      return { ...node, nonNullable: node.type.kind === "NonNullType" };
    },
    leave(node) {
      return `${node.name}${node.nonNullable ? "" : "?"}: ${node.type}`;
    },
  },
});

writeFileSync(
  join(__dirname, "schema.d.ts"),
  rows.map((row) => `export ${row}`).join("\n\n"),
  "utf-8"
);
