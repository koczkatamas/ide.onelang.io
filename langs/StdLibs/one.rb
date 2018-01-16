require 'strscan'

module One
    module Regex
        def Regex.matchFromIndex(pattern, input, offset)
            scanner = StringScanner.new input
            scanner.pos = offset
            return nil if not scanner.scan(Regexp.new pattern)
            
            result = []
            i = 0
            while true do
                curr = scanner[i]
                break if not curr
                result << curr
                i = i + 1
            end
            return result
        end
    end

    class Reflect
        @classes = {}

        class << self
          attr_accessor :classes
        end        

        def self.get_class(obj)
            return Reflect::get_class_by_name(obj.class.name)
        end

        def self.get_class_by_name(name)
            return self::classes[Reflect::name_key(name)]
        end
    
        def self.setup_class(cls)
            self::classes[Reflect::name_key(cls.name)] = cls
        end

        def self.name_key(name)
            return name.downcase.gsub(/_/, "")
        end
    end

    class Class
        attr_accessor(:type_obj, :name, :fields, :methods)

        def initialize(type_obj, fields, methods)
            @type_obj = type_obj
            @name = type_obj.name
            
            @fields = {}
            for field in fields
                field.cls = self
                @fields[Reflect::name_key(field.name)] = field
            end

            @methods = {}
            for method in methods
                method.cls = self
                @methods[Reflect::name_key(method.name)] = method
            end
        end

        def get_field(name)
            return self.fields[Reflect::name_key(name)]
        end

        def get_method(name)
            return self.methods[Reflect::name_key(name)]
        end
    
        def get_fields()
            return self.fields.values
        end

        def get_methods()
            return self.methods.values
        end
            
    end

    class Field
        attr_accessor(:cls, :name, :is_static, :type)

        def initialize(name, is_static, type)
            @name = name
            @is_static = is_static
            @type = type
        end

        def get_value(obj)
            realObj = @is_static ? @cls.type_obj : obj;
            return realObj.instance_variable_get("@" + @name)
        end

        def set_value(obj, value)
            realObj = @is_static ? @cls.type_obj : obj;
            realObj.instance_variable_set("@" + @name, value)
        end
    end

    class Method
        attr_accessor(:cls, :name, :is_static, :return_type, :args)

        def initialize(name, is_static, return_type, args)
            @name = name
            @is_static = is_static
            @return_type = return_type
            @args = args
        end

        def call(obj, args)
            if args.length != @args.length
                raise "Expected #{@args.length} arguments, but got #{args.length} in #{@cls.name}::#{@name} call!";
            end
    
            realObj = @is_static ? @cls.type_obj : obj;
            return realObj.send(@name, *args);
        end
    end

    class MethodArgument
        attr_accessor(:name, :type)

        def initialize(name, type)
            @name = name
            @type = type
        end
    end
end