package kuryer

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ctxKuryerID = "kuryer_id"
	ctxKuryer   = "kuryer"
)

func (m *Module) AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims, err := m.service.ParseToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		id, err := uuid.Parse(claims.KuryerID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		k, err := m.service.Me(c.Request.Context(), id)
		if err != nil || !k.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set(ctxKuryerID, id)
		c.Set(ctxKuryer, k)
		c.Next()
	}
}

func currentKuryer(c *gin.Context) *Kuryer {
	v, ok := c.Get(ctxKuryer)
	if !ok {
		return nil
	}
	k, _ := v.(*Kuryer)
	return k
}
