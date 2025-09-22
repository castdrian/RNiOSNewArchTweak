#pragma once

#include <cstddef>
#include <cstdint>
#include <exception>
#include <memory>
#include <string>
#include <functional>

namespace facebook {
namespace jsi {

class Buffer {
 public:
	virtual ~Buffer() = default;
	virtual size_t size() const = 0;
	virtual const uint8_t *data() const = 0;
};

class JSError : public std::exception {
 public:
	explicit JSError(std::string message) : message_(std::move(message)) {}
	const char *what() const noexcept override { return message_.c_str(); }
	const std::string &getMessage() const { return message_; }

 private:
	std::string message_;
};

class Object;

class Array {
public:
	Array() {}
	Array(class Runtime&, size_t) {}
	void setValueAtIndex(class Runtime&, size_t, Object&&) {}
};

class Object;
class Function;
class String;
class PropNameID;

class Value {
public:
	Value() {}
	Value(bool) {}
	// Allow implicit conversion from Object, Array, and std::shared_ptr<Function>
	Value(const Object&) {}
	Value(const Array&) {}
	Value(const Function&) {}
	Value(const std::shared_ptr<Function>&) {}
	static Value undefined() { return Value(); }
	bool isObject() const { return false; }
	bool isFunction(const class Runtime&) const { return false; }
	Object asObject(const class Runtime&) const;
};

class Object {
public:
	Object() {}
	Object(class Runtime&) {}
	Value getProperty(const class Runtime&, const std::string&) const { return Value(); }
	void setProperty(const class Runtime&, const std::string&, const Value&) {}
	Array asArray(const class Runtime&) const { return Array(); }
	Function asFunction(const class Runtime&) const;
	bool isFunction(const class Runtime&) const { return false; }
};

class Function : public Object {
public:
	Function() {}
	Function(const Function&) = default;
	Function(Function&&) = default;
	Function& operator=(const Function&) = default;
	Function& operator=(Function&&) = default;
	static std::shared_ptr<Function> createFromHostFunction(
			class Runtime&, const PropNameID&, int,
			std::function<Value(class Runtime&, const Value&, const Value*, size_t)>) {
		return std::make_shared<Function>();
	}
	Value call(class Runtime&, const Value*, int) { return Value(); }
	Value call(class Runtime&, const Value*, size_t) { return Value(); }
};

class String : public Value {
public:
	String() {}
	static String createFromUtf8(class Runtime&, const std::string&) { return String(); }
};

class PropNameID {
public:
	static PropNameID forAscii(class Runtime&, const std::string&) { return PropNameID(); }
};

class Runtime {
public:
	virtual ~Runtime() = default;
	virtual Object global() { return Object(); }
	virtual void evaluateJavaScript(std::shared_ptr<Buffer> buffer,
																	const std::string &sourceURL) {
		(void)buffer;
		(void)sourceURL;
	}
};

inline Object Value::asObject(const Runtime&) const { return Object(); }
inline Function Object::asFunction(const Runtime&) const { return Function(); }

}
}
