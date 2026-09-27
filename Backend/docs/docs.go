package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {},
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "paths": {
        "/health": {
            "get": {
                "produces": ["application/json"],
                "tags": ["system"],
                "summary": "API health",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {"type": "object"}
                    }
                }
            }
        },
        "/api/v1/admin/health": {
            "get": {
                "produces": ["application/json"],
                "tags": ["admin"],
                "summary": "Admin module health",
                "responses": {"200": {"description": "OK", "schema": {"type": "object"}}}
            }
        },
        "/api/v1/admin/ping": {
            "get": {
                "produces": ["application/json"],
                "tags": ["admin"],
                "summary": "Admin DB ping",
                "responses": {
                    "200": {"description": "OK", "schema": {"type": "object"}},
                    "503": {"description": "DB down", "schema": {"type": "object"}}
                }
            }
        },
        "/api/v1/kuryer/health": {
            "get": {
                "produces": ["application/json"],
                "tags": ["kuryer"],
                "summary": "Kuryer module health",
                "responses": {"200": {"description": "OK", "schema": {"type": "object"}}}
            }
        },
        "/api/v1/kuryer/ping": {
            "get": {
                "produces": ["application/json"],
                "tags": ["kuryer"],
                "summary": "Kuryer DB ping",
                "responses": {
                    "200": {"description": "OK", "schema": {"type": "object"}},
                    "503": {"description": "DB down", "schema": {"type": "object"}}
                }
            }
        },
        "/api/v1/user/health": {
            "get": {
                "produces": ["application/json"],
                "tags": ["user"],
                "summary": "User module health",
                "responses": {"200": {"description": "OK", "schema": {"type": "object"}}}
            }
        },
        "/api/v1/user/ping": {
            "get": {
                "produces": ["application/json"],
                "tags": ["user"],
                "summary": "User DB ping",
                "responses": {
                    "200": {"description": "OK", "schema": {"type": "object"}},
                    "503": {"description": "DB down", "schema": {"type": "object"}}
                }
            }
        }
    }
}`

var SwaggerInfo = &swag.Spec{
	Version:          "1.0",
	Host:             "localhost:8080",
	BasePath:         "/",
	Schemes:          []string{"http"},
	Title:            "Birga Arzon API",
	Description:      "Modular monolith backend for Admin, Kuryer and User apps.",
	InfoInstanceName: "swagger",
	SwaggerTemplate:  docTemplate,
	LeftDelim:        "{{",
	RightDelim:       "}}",
}

func init() {
	swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
