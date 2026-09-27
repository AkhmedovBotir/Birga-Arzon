package user

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ctxUserID = "user_id"
	ctxUser   = "user"
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
		id, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		u, err := m.service.Me(c.Request.Context(), id)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if u.IsBlocked {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "hisobingiz bloklangan"})
			return
		}
		c.Set(ctxUserID, id)
		c.Set(ctxUser, u)
		c.Next()
	}
}

func currentUser(c *gin.Context) *User {
	v, ok := c.Get(ctxUser)
	if !ok {
		return nil
	}
	u, _ := v.(*User)
	return u
}

func currentUserID(c *gin.Context) uuid.UUID {
	v, ok := c.Get(ctxUserID)
	if !ok {
		return uuid.Nil
	}
	id, _ := v.(uuid.UUID)
	return id
}
