package admin

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ctxAdminID   = "admin_id"
	ctxAdminRole = "admin_role"
	ctxAdmin     = "admin"
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
		id, err := uuid.Parse(claims.AdminID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		admin, err := m.service.Me(c.Request.Context(), id)
		if err != nil || !admin.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set(ctxAdminID, id)
		c.Set(ctxAdminRole, admin.Role)
		c.Set(ctxAdmin, admin)
		c.Next()
	}
}

func (m *Module) GeneralRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(ctxAdminRole)
		if role != RoleGeneral {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "general role required"})
			return
		}
		c.Next()
	}
}

func currentAdmin(c *gin.Context) *Admin {
	v, ok := c.Get(ctxAdmin)
	if !ok {
		return nil
	}
	a, _ := v.(*Admin)
	return a
}
