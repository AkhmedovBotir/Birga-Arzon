package i18n

import (
	"context"
	"net/http"
	"strings"
)

type ctxKey struct{}

func Parse(header string) string {
	h := strings.ToLower(strings.TrimSpace(header))
	if h == "" {
		return "uz"
	}
	first := strings.Split(h, ",")[0]
	first = strings.TrimSpace(strings.Split(first, ";")[0])
	if strings.Contains(first, "cyrl") || first == "uz-cyrl" || first == "uz_cyrl" {
		return "cyrl"
	}
	if strings.HasPrefix(first, "ru") {
		return "ru"
	}
	return "uz"
}

func WithLang(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, ctxKey{}, lang)
}

func FromRequest(r *http.Request) string {
	if r == nil {
		return "uz"
	}
	if v, ok := r.Context().Value(ctxKey{}).(string); ok && v != "" {
		return v
	}
	return Parse(r.Header.Get("Accept-Language"))
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := Parse(r.Header.Get("Accept-Language"))
		next.ServeHTTP(&langWriter{ResponseWriter: w, lang: lang}, r.WithContext(WithLang(r.Context(), lang)))
	})
}

type langWriter struct {
	http.ResponseWriter
	lang string
}

func (w *langWriter) Lang() string { return w.lang }

func Unwrap(w http.ResponseWriter) (http.ResponseWriter, string) {
	if lw, ok := w.(*langWriter); ok {
		return lw.ResponseWriter, lw.lang
	}
	return w, "uz"
}
