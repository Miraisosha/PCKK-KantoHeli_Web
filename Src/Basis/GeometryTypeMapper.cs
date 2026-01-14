
using System.Data;
using NetTopologySuite.Geometries;
using Npgsql;
using NpgsqlTypes;

namespace Src.Basis;

/// <summary>
/// DapperでGeometry型を操作できるようにするためのMapper
/// </summary>
/// <remarks>
/// Dapper.SqlMapper.AddTypeHandler()で型ハンドラとして登録すること
/// </remarks>
/// <typeparam name="T">Geometry型、もしくはLineString型など具体的なジオメトリの型</typeparam>
class GeometryTypeMapper<T>(NpgsqlDbType type = NpgsqlDbType.Geometry) : Dapper.SqlMapper.TypeHandler<T>
    where T : Geometry
{
    private readonly NpgsqlDbType _npgsqlDbType = type;

    public override void SetValue(IDbDataParameter parameter, T? value)
    {
        if (parameter is NpgsqlParameter npgsqlParameter)
        {
            npgsqlParameter.NpgsqlDbType = _npgsqlDbType;
            npgsqlParameter.NpgsqlValue = value;
        }
        else
        {
            throw new ArgumentException($"Geometry値としてパラメータバインドできません。value: {value}");
        }
    }

    public override T? Parse(object value)
    {
        if (value is DBNull) { return null; }
        return (value is T geometry)
            ? geometry
            : throw new ArgumentException($"Geometry値としてParseできません。value: {value}");
    }
}
